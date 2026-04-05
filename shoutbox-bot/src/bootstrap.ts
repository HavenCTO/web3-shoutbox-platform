import GunDefault from 'gun'
import WebSocket from 'ws'
import OpenAI from 'openai'
import { join } from 'node:path'
import { privateKeyToAccount } from 'viem/accounts'
import type { Hex } from 'viem'
import type { BotConfig } from './botConfig.js'
import { gunIsolateDirectory } from './gunCwd.js'
import { PRESENCE_HEARTBEAT_MS, GUN_NAMESPACE } from './constants.js'
import { createContextualPeerReplyGenerator } from './openaiReply.js'
import { createShoutboxGunMemoryStore } from './gunMemoryStore.js'
import { formatShoutboxReply } from './reply.js'
import { subscribeToGroupWindow } from './groupSubscription.js'
import { startGunPresenceHeartbeat } from './presence.js'
import type { ShoutboxGunRef } from './gunTypes.js'
import { type RunShoutboxBotHandle, runShoutboxBot } from './orchestrator.js'
import { createShoutboxBotClient } from './xmtpFactory.js'
import { createShoutboxXmtpPort } from './xmtpMessaging.js'
import { hashUrl } from './roomKey.js'

export interface ShoutboxBotRuntimeImpl {
  createGun: (peers: readonly string[]) => ShoutboxGunRef
  createXmtpClient: typeof createShoutboxBotClient
}

const GunFactory = GunDefault as unknown as (opts: {
  peers: string[]
  localStorage: boolean
  radisk: boolean
  rad?: boolean
  rfs?: boolean
  file: string
  store: ReturnType<typeof createShoutboxGunMemoryStore>
  WebSocket?: unknown
}) => unknown

export const defaultRuntimeImpl: ShoutboxBotRuntimeImpl = {
  createGun(peers) {
    const fileRoot = join(gunIsolateDirectory(), 'radata')
    const gun = GunFactory({
      peers: [...peers],
      localStorage: false,
      radisk: true,
      file: fileRoot,
      store: createShoutboxGunMemoryStore(),
      WebSocket,
    })

    // Gun's Node.js entry (lib/server.js) sets root.once = 1 which causes
    // the built-in websocket handler (src/websocket.js) to skip initiating
    // outbound WebSocket connections to relay peers.  Manually emitting the
    // 'hi' DAM message forces the mesh layer to open those connections.
    const root = (gun as unknown as { back(n: number): { _: { on(ev: string, msg: unknown): void } } }).back(-1)._
    root.on('out', { dam: 'hi' })

    // Log peer state
    console.log(`[shoutbox-bot] Gun peers configured: ${peers.join(', ')}`)

    // Periodically re-emit 'hi' DAM to keep relay connections alive.
    // Gun's Node.js WebSocket layer can silently drop outbound connections;
    // re-emitting 'hi' forces them to re-open.
    setInterval(() => {
      root.on('out', { dam: 'hi' })
    }, 15_000)

    // Monitor Gun 'in' events to confirm relay data is flowing
    let lastGunIn = Date.now()
    root.on('in', () => { lastGunIn = Date.now() })
    setInterval(() => {
      const silenceMs = Date.now() - lastGunIn
      if (silenceMs > 30_000) {
        console.log(`[shoutbox-bot] ⚠ Gun relay silent for ${Math.round(silenceMs / 1000)}s — forcing reconnect`)
        root.on('out', { dam: 'hi' })
      }
    }, 20_000)

    return gun as ShoutboxGunRef
  },
  createXmtpClient: createShoutboxBotClient,
}

export async function startShoutboxRoomBotFromConfig(
  cfg: BotConfig,
  impl: ShoutboxBotRuntimeImpl,
): Promise<RunShoutboxBotHandle> {
  const gun = impl.createGun(cfg.gunRelayPeers)
  const account = privateKeyToAccount(cfg.privateKey as Hex)
  console.log(
    `[shoutbox-bot] XMTP env=${cfg.xmtpEnv} wallet=${account.address} — creating client (first run can take 1–2 minutes)…`,
  )
  const client = await impl.createXmtpClient({
    privateKey: cfg.privateKey as Hex,
    env: cfg.xmtpEnv,
    dbPath: cfg.dbPath,
    dbEncryptionKey: cfg.dbEncryptionKey,
  })
  console.log(`[shoutbox-bot] XMTP client ready inbox=${client.inboxId.slice(0, 12)}…`)
  const xmtp = createShoutboxXmtpPort(client, console.log)

  const formatReply =
    cfg.llm !== undefined
      ? createContextualPeerReplyGenerator(
          new OpenAI({
            baseURL: cfg.llm.baseUrl,
            apiKey: cfg.llm.apiKey,
          }),
          {
            model: cfg.llm.model,
            systemPrompt: cfg.llm.systemPrompt,
          },
        )
      : async (ctx: Parameters<typeof formatShoutboxReply>[0]) => formatShoutboxReply(ctx)

  const handle = await runShoutboxBot({
    cfg: {
      roomUrl: cfg.roomUrl,
      botEthereumAddress: account.address,
      contextMessageLimit: cfg.contextMessageLimit,
      formatReply,
      log: console.log,
    },
    groupSubscriber: {
      subscribe: (roomKey, onWindow) =>
        subscribeToGroupWindow(gun, roomKey, onWindow, {
          now: () => Date.now(),
        }),
    },
    presence: {
      start: (roomKey, inboxId, address) =>
        startGunPresenceHeartbeat({
          gun,
          roomKey,
          inboxId,
          address,
          intervalMs: PRESENCE_HEARTBEAT_MS,
          now: () => Date.now(),
          setIntervalFn: globalThis.setInterval.bind(globalThis),
          clearIntervalFn: globalThis.clearInterval.bind(globalThis),
          log: console.log,
        }),
    },
    xmtp,
  })

  // ── Relay warmer: a second Gun peer that subscribes to the same presence
  // path.  When only one peer writes AND reads, Gun relays may not broadcast
  // updates to browser subscribers.  A second local peer forces the relay to
  // treat the data as "requested by multiple peers" which triggers active
  // push to all connected subscribers (including browsers). ──
  const roomKey = await hashUrl(cfg.roomUrl)
  const warmerFileRoot = join(gunIsolateDirectory(), 'radata-warmer')
  const warmerGun = GunFactory({
    peers: [...cfg.gunRelayPeers],
    localStorage: false,
    radisk: true,
    file: warmerFileRoot,
    store: createShoutboxGunMemoryStore(),
    WebSocket,
  }) as ShoutboxGunRef
  // Open outbound connections on the warmer peer
  const warmerRoot = (warmerGun as unknown as { back(n: number): { _: { on(ev: string, msg: unknown): void } } }).back(-1)._
  warmerRoot.on('out', { dam: 'hi' })
  // Keep warmer connections alive
  setInterval(() => { warmerRoot.on('out', { dam: 'hi' }) }, 15_000)

  // Subscribe the warmer peer to the room presence map
  const presenceMap = new Map<string, { ts: number; status: string }>()
  const warmerPresenceRef = warmerGun.get(GUN_NAMESPACE).get('presence').get(roomKey)
  const warmerMapRef = warmerPresenceRef as unknown as {
    map(): { on(cb: (data: unknown, key: string) => void): unknown }
  }
  warmerMapRef.map().on((data: unknown, key: string) => {
    if (data && typeof data === 'object' && 'ts' in data) {
      const rec = data as { ts: number; status: string; inboxId?: string }
      presenceMap.set(key, { ts: rec.ts, status: rec.status })
    }
  })
  console.log(`[shoutbox-bot] relay warmer peer started — subscribing to presence for room ${roomKey.slice(0, 8)}…`)

  // Periodically log what the warmer peer sees
  setInterval(() => {
    const now = Date.now()
    const online: string[] = []
    const stale: string[] = []
    for (const [id, rec] of presenceMap) {
      const age = now - rec.ts
      if (age < 30_000 && rec.status !== 'offline') {
        online.push(`${id.slice(0, 8)}…(${Math.round(age / 1000)}s)`)
      } else {
        stale.push(`${id.slice(0, 8)}…(${Math.round(age / 1000)}s)`)
      }
    }
    console.log(
      `[shoutbox-bot] presence map: ${online.length} online [${online.join(', ')}]` +
      (stale.length ? ` | ${stale.length} stale [${stale.join(', ')}]` : ''),
    )
  }, 15_000)

  return handle
}
