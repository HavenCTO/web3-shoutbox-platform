/**
 * Sovereign Shoutbox Bot — Entry Point
 *
 * Boots the 5-machine kernel with real provider, real wallet, XMTP channel,
 * and GunDB presence. Replaces the CLI entry point for production shoutbox use.
 *
 * All chain-specific and provider-specific code comes from haven-adapters —
 * the kernel (haven-core) is agnostic.
 *
 * Message flow:
 *   XMTP → MessageBus → AgentLoop → Treasury cost-check → LLM Provider
 *   → AgentLoop → MessageBus → XMTP
 *
 * The kernel never imports viem, @xmtp/node-sdk, or gun.
 */

import "dotenv/config";
import GunDefault from "gun";
import WebSocket from "ws";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync, mkdirSync } from "node:fs";
import { hexToBytes, type Hex } from "viem";
import type { XmtpEnv } from "@xmtp/node-sdk";

// ── haven-core: kernel + types ──
import { SovereignAgentKernel } from "haven-core/kernel";
import {
  BudgetCategory,
  SigningType,
  type SigningResult,
  type TreasuryReport,
} from "haven-core/types";

// ── haven-adapters: chain + provider adapters ──
import { createEthereumCryptoAdapter, XmtpChannel, LmStudioProvider } from "haven-adapters";

// ── haven-adapters: AgentLoop context type ──
import type { ContextMessage } from "haven-core/machines/AgentLoop";

// ── Shoutbox-specific ──
import {
  startGunPresence,
  hashUrl,
  type GunRef,
  type PresenceData,
} from "./GunPresence.js";

// ============================================================================
// Configuration (from environment)
// ============================================================================

interface ShoutboxBotConfig {
  roomUrl: string;
  privateKey: Hex;
  xmtpEnv: XmtpEnv;
  gunRelayPeers: string[];
  lmStudioBaseUrl: string;
  lmStudioModel: string;
  dbPath?: string;
}

function loadConfig(): ShoutboxBotConfig {
  const roomUrl = process.env.SHOUTBOX_ROOM_URL;
  if (!roomUrl) throw new Error("SHOUTBOX_ROOM_URL is required");

  const privateKey = process.env.SHOUTBOX_BOT_PRIVATE_KEY;
  if (!privateKey) throw new Error("SHOUTBOX_BOT_PRIVATE_KEY is required");

  const xmtpEnv = (process.env.SHOUTBOX_XMTP_ENV || "dev") as XmtpEnv;

  const peersRaw = process.env.SHOUTBOX_GUN_RELAY_PEERS || "";
  const gunRelayPeers = peersRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (gunRelayPeers.length === 0) {
    throw new Error("SHOUTBOX_GUN_RELAY_PEERS is required (comma-separated)");
  }

  const lmStudioBaseUrl =
    process.env.SHOUTBOX_OPENAI_BASE_URL ||
    process.env.SOVEREIGN_AGENT_LM_STUDIO_URL ||
    "http://127.0.0.1:1234";

  const lmStudioModel =
    process.env.SHOUTBOX_OPENAI_MODEL ||
    process.env.SOVEREIGN_AGENT_MODEL ||
    "qwen/qwen3-4b-2507";

  const dbPath = process.env.SHOUTBOX_BOT_DB_PATH;

  return {
    roomUrl,
    privateKey: privateKey as Hex,
    xmtpEnv,
    gunRelayPeers,
    lmStudioBaseUrl,
    lmStudioModel,
    dbPath,
  };
}

// ============================================================================
// GunDB factory (adapted from shoutbox-bot/src/bootstrap.ts)
// ============================================================================

function applyGunNodeDefaults(): void {
  if (!process.env.RAD || process.env.RAD.trim() === "") {
    process.env.RAD = "true";
  }
}

/** GunDB namespace — must match the web app and GunPresence.ts. */
const GUN_NAMESPACE = "shoutbox-v1";

function createGunMemoryStore() {
  const files = new Map<string, string>();
  return {
    put(file: string, data: string, cb: (err: null, ok?: number) => void) {
      files.set(file, data);
      queueMicrotask(() => cb(null, 1));
    },
    get(file: string, cb: (err?: null, data?: string) => void) {
      queueMicrotask(() => {
        const data = files.get(file);
        data === undefined ? cb() : cb(null, data);
      });
    },
    list(cb: (file?: string) => void) {
      for (const k of files.keys()) cb(k);
      cb();
    },
  };
}

function createGun(peers: string[], label = "main"): GunRef {
  const gunDir = join(tmpdir(), `sovereign-bot-gun-${label}-${process.pid}`);
  if (!existsSync(gunDir)) mkdirSync(gunDir, { recursive: true });

  const GunFactory = GunDefault as unknown as (opts: Record<string, unknown>) => unknown;
  const gun = GunFactory({
    peers: [...peers],
    localStorage: false,
    radisk: true,
    file: join(gunDir, "radata"),
    store: createGunMemoryStore(),
    WebSocket,
  }) as GunRef;

  // Force outbound peer connections (Gun Node.js quirk)
  const root = (gun as unknown as { back(n: number): { _: { on(ev: string, msg: unknown): void } } }).back(-1)._;
  root.on("out", { dam: "hi" });

  // Keep relay connections alive
  setInterval(() => {
    root.on("out", { dam: "hi" });
  }, 15_000);

  // Monitor Gun 'in' events to confirm relay data is flowing.
  // If silent for >30s, force reconnect (adapted from shoutbox-bot/src/bootstrap.ts).
  let lastGunIn = Date.now();
  root.on("in", () => { lastGunIn = Date.now(); });
  setInterval(() => {
    const silenceMs = Date.now() - lastGunIn;
    if (silenceMs > 30_000) {
      console.log(
        `[sovereign-bot] ⚠ Gun relay (${label}) silent for ${Math.round(silenceMs / 1000)}s — forcing reconnect`
      );
      root.on("out", { dam: "hi" });
    }
  }, 20_000);

  console.log(`[sovereign-bot] Gun peers (${label}): ${peers.join(", ")}`);
  return gun;
}

/**
 * Relay warmer: a second Gun peer that subscribes to the same presence path.
 * When only one peer writes AND reads, Gun relays may not broadcast updates
 * to browser subscribers. A second local peer forces the relay to treat the
 * data as "requested by multiple peers" which triggers active push to all
 * connected subscribers (including browsers).
 *
 * Adapted from shoutbox-bot/src/bootstrap.ts.
 */
function startRelayWarmer(
  peers: string[],
  roomKey: string
): void {
  const warmerGun = createGun(peers, "warmer");

  const presenceMap = new Map<string, { ts: number; status: string }>();
  const warmerPresenceRef = warmerGun.get(GUN_NAMESPACE).get("presence").get(roomKey);
  const warmerMapRef = warmerPresenceRef as unknown as {
    map(): { on(cb: (data: unknown, key: string) => void): unknown };
  };
  warmerMapRef.map().on((data: unknown, key: string) => {
    if (data && typeof data === "object" && "ts" in data) {
      const rec = data as { ts: number; status: string };
      presenceMap.set(key, { ts: rec.ts, status: rec.status });
    }
  });

  console.log(
    `[sovereign-bot] relay warmer started — subscribing to presence for room ${roomKey.slice(0, 8)}...`
  );

  // Periodically log what the warmer peer sees
  setInterval(() => {
    const now = Date.now();
    const online: string[] = [];
    const stale: string[] = [];
    for (const [id, rec] of presenceMap) {
      const age = now - rec.ts;
      if (age < 30_000 && rec.status !== "offline") {
        online.push(`${id.slice(0, 8)}…(${Math.round(age / 1000)}s)`);
      } else {
        stale.push(`${id.slice(0, 8)}…(${Math.round(age / 1000)}s)`);
      }
    }
    console.log(
      `[sovereign-bot] presence map: ${online.length} online [${online.join(", ")}]` +
      (stale.length ? ` | ${stale.length} stale [${stale.join(", ")}]` : "")
    );
  }, 15_000);
}

// ============================================================================
// System prompt builder
// ============================================================================

function buildSystemPrompt(
  walletAddress: string,
  treasuryReport: TreasuryReport,
  presence?: PresenceData
): string {
  const lines: string[] = [
    "You are a sovereign AI agent in a public shoutbox chat room.",
    "Keep each reply short (under 280 characters) and friendly.",
    "",
    `Your wallet address: ${walletAddress}`,
    `Treasury state: ${treasuryReport.state} (runway: ${treasuryReport.runwayDays} days)`,
  ];

  if (presence) {
    const memberCount = presence.members.length;
    const memberList = presence.members
      .map((m) => m.slice(0, 8) + "...")
      .join(", ");
    lines.push("");
    lines.push(`Room: ${presence.roomKey.slice(0, 8)}...`);
    lines.push(
      `Online members (${memberCount}): ${memberList || "(none)"}`
    );
    if (presence.activeGroupId) {
      lines.push(
        `Active group: ${presence.activeGroupId.slice(0, 8)}...`
      );
    }
  }

  lines.push("");
  lines.push(
    "This is a short-lived public shoutbox group (roughly five minutes). " +
    "Reply to the latest peer message in context with other participants."
  );

  return lines.join("\n");
}

function isSigningResult(payload: unknown): payload is SigningResult {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as Partial<SigningResult>;
  return (
    typeof candidate.requestId === "string" &&
    typeof candidate.signature === "string" &&
    typeof candidate.success === "boolean" &&
    typeof candidate.error === "string"
  );
}

function createKernelSigner(
  kernel: SovereignAgentKernel,
  requestorId: string
): (message: string) => Promise<Uint8Array> {
  return (message: string) =>
    new Promise<Uint8Array>((resolve, reject) => {
      const requestId = `xmtp_sign_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const timeoutMs = 15_000;

      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Wallet signing timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const unsubscribe = kernel.wallet.subscribe((evt: { event: string; payload: unknown }) => {
        if (evt.event !== "eSignResult") return;
        if (!isSigningResult(evt.payload)) return;
        if (evt.payload.requestId !== requestId) return;

        clearTimeout(timeout);
        unsubscribe();

        if (!evt.payload.success) {
          reject(new Error(evt.payload.error || "Wallet signing failed"));
          return;
        }
        resolve(hexToBytes(evt.payload.signature as `0x${string}`));
      });

      kernel.wallet.enqueue("eSignRequest", {
        id: requestId,
        signingType: SigningType.MESSAGE,
        payload: message,
        chain: "ethereum",
        requestor: requestorId,
      });
    });
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║        SOVEREIGN SHOUTBOX BOT — Kernel + Extensions         ║");
  console.log("║                                                              ║");
  console.log("║  Kernel: WalletIdentity • Treasury • MessageBus             ║");
  console.log("║          ToolExecutor • AgentLoop                            ║");
  console.log("║  Extensions: LmStudioProvider • EthereumCrypto              ║");
  console.log("║              XmtpChannel • GunPresence                       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");

  applyGunNodeDefaults();
  const cfg = loadConfig();

  console.log(`[sovereign-bot] Room: ${cfg.roomUrl}`);
  console.log(`[sovereign-bot] XMTP env: ${cfg.xmtpEnv}`);
  console.log(`[sovereign-bot] LLM: ${cfg.lmStudioModel} @ ${cfg.lmStudioBaseUrl}`);

  // ── 1. Create kernel ──
  const kernel = new SovereignAgentKernel();

  // ── 2. Inject Ethereum crypto adapter (kernel doesn't know it's Ethereum) ──
  kernel.wallet.setCryptoAdapter(createEthereumCryptoAdapter());

  // ── 3. Replace stub provider with LM Studio (kernel doesn't know it's LM Studio) ──
  const lmProvider = new LmStudioProvider(
    kernel.registry,
    "provider",
    { modelId: cfg.lmStudioModel, baseUrl: cfg.lmStudioBaseUrl }
  );
  await lmProvider.initialize();
  kernel.agent.setProvider(lmProvider);

  // ── 4. Register shoutbox tools ──
  kernel.registerTool(
    {
      name: "get_time",
      description: "Get the current time",
      estimatedCost: { amounts: [], category: BudgetCategory.TOOLS },
    },
    () => new Date().toISOString()
  );

  // ── 5. Start kernel with real wallet ──
  await kernel.start({ keySource: cfg.privateKey });

  console.log(`[sovereign-bot] Wallet address: ${kernel.wallet.getAddress()}`);

  // ── 6. Shared presence store (host-level, not in the kernel) ──
  const presenceStore = new Map<string, PresenceData>();

  // ── 7. Set system prompt via transformContext ──
  kernel.setTransformContext(
    (messages: ContextMessage[], sessionKey: string) => {
      const chatId = sessionKey.split(":")[1];
      const presence = presenceStore.get(chatId) || presenceStore.values().next().value;
      const systemPrompt = buildSystemPrompt(
        kernel.wallet.getAddress(),
        kernel.treasury.getReport(),
        presence
      );
      return [
        { role: "system", content: systemPrompt },
        ...messages.slice(-20), // Keep last 20 messages for context window
      ];
    }
  );

  // ── 8. Plug in XMTP channel (kernel doesn't know about XMTP) ──
  console.log("[sovereign-bot] Creating XMTP client (first run can take 1-2 minutes)...");
  const xmtpMachineId = "xmtpChannel";
  const xmtp = new XmtpChannel(
    kernel.registry,
    kernel.bus,
    {
      walletAddress: kernel.wallet.getAddress(),
      signMessage: createKernelSigner(kernel, xmtpMachineId),
      xmtpEnv: cfg.xmtpEnv,
      dbPath: cfg.dbPath,
    },
    xmtpMachineId
  );
  await xmtp.initialize();
  xmtp.enqueue("eStart");

  // Wait for XMTP to actually connect (poll for inboxId since waitForIdle
  // resolves before the async Connecting onEntry completes).
  console.log("[sovereign-bot] Waiting for XMTP connection...");
  const xmtpConnectStart = Date.now();
  while (!xmtp.inboxId && Date.now() - xmtpConnectStart < 180_000) {
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!xmtp.inboxId) {
    throw new Error("XMTP failed to connect within 3 minutes");
  }
  console.log(`[sovereign-bot] XMTP inbox: ${xmtp.inboxId.slice(0, 12)}...`);

  // ── 9. Start GunDB presence (kernel doesn't know about GunDB) ──
  const gun = createGun(cfg.gunRelayPeers);
  const roomKey = await hashUrl(cfg.roomUrl);
  console.log(`[sovereign-bot] Room key: ${roomKey.slice(0, 8)}...`);

  const stopPresence = startGunPresence({
    gun,
    roomKey,
    inboxId: xmtp.inboxId,
    address: kernel.wallet.getAddress(),
    presenceStore,
    onGroupWindowChange: (gw) => {
      if (gw) {
        xmtp.setActiveGroupId(gw.groupId);
        // Re-sync XMTP consent when a new group appears
        xmtp.getClient()?.conversations.sync().catch(() => {});
      } else {
        xmtp.setActiveGroupId("");
      }
    },
    log: console.log,
  });

  // ── 9b. Start relay warmer (forces Gun relay to push presence to browsers) ──
  startRelayWarmer(cfg.gunRelayPeers, roomKey);

  // ── 10. Running ──
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Sovereign Shoutbox Bot is RUNNING");
  console.log(`  Wallet:    ${kernel.wallet.getAddress()}`);
  console.log(`  Treasury:  ${kernel.treasury.getTreasuryState()}`);
  console.log(`  XMTP:      ${xmtp.inboxId.slice(0, 12)}...`);
  console.log(`  Room:      ${roomKey.slice(0, 8)}...`);
  console.log(`  LLM:       ${cfg.lmStudioModel}`);
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");

  // ── Graceful shutdown ──
  const shutdown = async (): Promise<void> => {
    console.log("\n[sovereign-bot] Shutting down...");
    stopPresence();
    xmtp.enqueue("eStop");
    await xmtp.waitForIdle();
    await kernel.stop();
    console.log("[sovereign-bot] Shutdown complete.");
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err) => {
  console.error("[sovereign-bot] Fatal error:", err);
  process.exit(1);
});
