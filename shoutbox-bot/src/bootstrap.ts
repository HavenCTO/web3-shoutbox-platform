import GunDefault from 'gun'
import WebSocket from 'ws'
import OpenAI from 'openai'
import { join } from 'node:path'
import { privateKeyToAccount } from 'viem/accounts'
import type { Hex } from 'viem'
import type { BotConfig } from './botConfig.js'
import { gunIsolateDirectory } from './gunCwd.js'
import { PRESENCE_HEARTBEAT_MS } from './constants.js'
import { createContextualPeerReplyGenerator } from './openaiReply.js'
import { createShoutboxGunMemoryStore } from './gunMemoryStore.js'
import { formatShoutboxReply } from './reply.js'
import { subscribeToGroupWindow } from './groupSubscription.js'
import { startGunPresenceHeartbeat } from './presence.js'
import type { ShoutboxGunRef } from './gunTypes.js'
import { type RunShoutboxBotHandle, runShoutboxBot } from './orchestrator.js'
import { createShoutboxBotClient } from './xmtpFactory.js'
import { createShoutboxXmtpPort } from './xmtpMessaging.js'

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
  const xmtp = createShoutboxXmtpPort(client)

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

  return runShoutboxBot({
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
}
