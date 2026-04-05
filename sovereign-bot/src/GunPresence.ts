/**
 * GunPresence — GunDB presence heartbeat + group window subscription.
 *
 * Shoutbox-specific — the kernel never imports gun.
 * This is a utility module, not a full state machine. It:
 *   - Heartbeats GunDB presence so the shoutbox sliding-window leader
 *     includes the bot when creating XMTP groups
 *   - Subscribes to group window changes and updates the active group
 *   - Writes presence data to a shared store that transformContext can read
 *
 * Adapted from shoutbox-bot/src/presence.ts, groupSubscription.ts, roomKey.ts.
 *
 * The kernel never imports this module. The host wires it in the entry point.
 */

/** GunDB namespace — must match the web app's src/lib/gun.ts. */
const GUN_NAMESPACE = "shoutbox-v1";

/** Presence heartbeat interval (ms). */
const PRESENCE_HEARTBEAT_MS = 10_000;

/** Minimal Gun chain interface (same as shoutbox-bot/src/gunTypes.ts). */
export interface GunRef {
  get(key: string): GunRef;
  put(value: unknown, cb?: (ack: { err?: unknown }) => void): GunRef;
  on(callback: (data: unknown) => void): GunRef;
  off(): GunRef;
}

/** Presence data written to the shared store for system prompt injection. */
export interface PresenceData {
  members: string[];
  roomKey: string;
  activeGroupId: string;
}

/** Parsed group window from GunDB. */
export interface GroupWindow {
  groupId: string;
  epoch: number;
  createdBy: string;
  createdAt: number;
  expiresAt: number;
  windowMinutes: number;
}

/** Options for starting GunDB presence. */
export interface GunPresenceOptions {
  gun: GunRef;
  roomKey: string;
  inboxId: string;
  address: string;
  /** Shared presence store — host passes this to both GunPresence and transformContext. */
  presenceStore: Map<string, PresenceData>;
  /** Called when the active group window changes. */
  onGroupWindowChange?: (gw: GroupWindow | null) => void;
  log?: (line: string) => void;
}

/**
 * Start GunDB presence heartbeat and group window subscription.
 * Returns a stop function that cleans up all intervals and subscriptions.
 */
export function startGunPresence(opts: GunPresenceOptions): () => void {
  const log = opts.log || (() => {});
  const cleanupFns: Array<() => void> = [];

  // ── Presence Heartbeat ──
  const presenceRef = opts.gun
    .get(GUN_NAMESPACE)
    .get("presence")
    .get(opts.roomKey)
    .get(opts.inboxId);

  let tickCount = 0;
  const tick = (): void => {
    tickCount++;
    const now = Date.now();
    const payload = {
      inboxId: opts.inboxId,
      address: opts.address,
      ts: now,
      status: "online" as const,
    };
    if (tickCount <= 3 || tickCount % 6 === 0) {
      log(
        `[GunPresence] heartbeat #${tickCount} room=${opts.roomKey.slice(0, 8)}...`
      );
    }
    presenceRef.put(payload, (ack) => {
      if (ack?.err) {
        log(`[GunPresence] put error: ${formatErr(ack.err)}`);
      }
    });
  };

  tick();
  const heartbeatTimer = setInterval(tick, PRESENCE_HEARTBEAT_MS);
  cleanupFns.push(() => clearInterval(heartbeatTimer));

  // ── Group Window Subscription ──
  const groupRef = opts.gun
    .get(GUN_NAMESPACE)
    .get("groups")
    .get(opts.roomKey);

  let currentGroupId = "";

  const groupHandler = (data: unknown): void => {
    const gw = parseGroupWindow(data);
    if (gw === null || !isActive(gw)) {
      if (currentGroupId !== "") {
        currentGroupId = "";
        log("[GunPresence] no active group window");
        updateStore("", []);
        opts.onGroupWindowChange?.(null);
      }
      return;
    }
    if (gw.groupId !== currentGroupId) {
      currentGroupId = gw.groupId;
      log(
        `[GunPresence] group ${gw.groupId.slice(0, 8)}... epoch=${gw.epoch}`
      );
      updateStore(gw.groupId, []);
      opts.onGroupWindowChange?.(gw);
    }
  };

  groupRef.on(groupHandler);
  cleanupFns.push(() => groupRef.off());

  // ── Presence Map Subscription (for system prompt context) ──
  const presenceMapRef = opts.gun
    .get(GUN_NAMESPACE)
    .get("presence")
    .get(opts.roomKey) as unknown as {
    map(): { on(cb: (data: unknown, key: string) => void): unknown };
  };

  const memberMap = new Map<string, { ts: number; status: string }>();

  presenceMapRef.map().on((data: unknown, key: string) => {
    if (data && typeof data === "object" && "ts" in data) {
      const rec = data as { ts: number; status: string };
      memberMap.set(key, { ts: rec.ts, status: rec.status });

      // Update store with online members
      const now = Date.now();
      const onlineMembers: string[] = [];
      for (const [id, m] of memberMap) {
        if (now - m.ts < 30_000 && m.status !== "offline") {
          onlineMembers.push(id);
        }
      }
      updateStore(currentGroupId, onlineMembers);
    }
  });

  function updateStore(groupId: string, members: string[]): void {
    opts.presenceStore.set(opts.roomKey, {
      members,
      roomKey: opts.roomKey,
      activeGroupId: groupId,
    });
  }

  // ── Stop ──
  return () => {
    for (const fn of cleanupFns) {
      fn();
    }
  };
}

// ============================================================================
// Room key derivation — matches src/lib/url-utils.ts in the web app.
// ============================================================================

/** Normalize URL for room identity. */
export function normalizeUrl(raw: string): string {
  const url = new URL(raw);
  const path = url.pathname.replace(/\/+$/, "") || "";
  return `${url.protocol}//${url.hostname.toLowerCase()}${path}`;
}

/** SHA-256 hex digest of the normalized URL. */
export async function hashUrl(raw: string): Promise<string> {
  const normalized = normalizeUrl(raw);
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================================
// Helpers
// ============================================================================

function parseGroupWindow(data: unknown): GroupWindow | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (
    typeof d.groupId !== "string" ||
    typeof d.epoch !== "number" ||
    typeof d.expiresAt !== "number"
  ) {
    return null;
  }
  return {
    groupId: d.groupId as string,
    epoch: d.epoch as number,
    createdBy: (d.createdBy as string) || "",
    createdAt: (d.createdAt as number) || 0,
    expiresAt: d.expiresAt as number,
    windowMinutes: (d.windowMinutes as number) || 5,
  };
}

function isActive(gw: GroupWindow): boolean {
  return Date.now() <= gw.expiresAt;
}

function formatErr(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
