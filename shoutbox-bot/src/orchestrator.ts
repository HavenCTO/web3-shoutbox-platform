import type { DecodedMessage } from '@xmtp/node-sdk'
import type { GroupWindow } from './groupWindow.js'
import { hashUrl, normalizeUrl } from './roomKey.js'
import {
  shouldProcessShoutboxMessage,
  textFromDecodedMessage,
} from './messagePolicy.js'
import {
  mergeTriggerIntoTranscript,
  type ShoutboxReplyContext,
} from './shoutboxContext.js'
import type { ShoutboxXmtpPort } from './xmtpMessaging.js'

export interface GroupWindowSubscriber {
  subscribe: (
    roomKey: string,
    onWindow: (gw: GroupWindow | null) => void,
  ) => () => void
}

export interface PresenceStarter {
  start(roomKey: string, inboxId: string, address: string): () => void
}

export interface OrchestratorConfig {
  roomUrl: string
  botEthereumAddress: string
  contextMessageLimit: number
  formatReply: (ctx: ShoutboxReplyContext) => Promise<string>
  log: (line: string) => void
}

export interface OrchestratorDeps {
  cfg: OrchestratorConfig
  groupSubscriber: GroupWindowSubscriber
  presence: PresenceStarter
  xmtp: ShoutboxXmtpPort
}

export interface RunShoutboxBotHandle {
  stop: () => Promise<void>
}

/**
 * Tie together room key, Gun presence + group subscription, and XMTP streaming/sends.
 */
export async function runShoutboxBot(
  deps: OrchestratorDeps,
): Promise<RunShoutboxBotHandle> {
  const roomKey = await hashUrl(deps.cfg.roomUrl)
  const normalizedRoomUrl = normalizeUrl(deps.cfg.roomUrl)
  const uiHashLabel = `${roomKey.slice(0, 6)}…${roomKey.slice(-4)}`
  deps.cfg.log(
    `[shoutbox-bot] room key ${roomKey} — UI # ${uiHashLabel} | ${normalizedRoomUrl}`,
  )
  const state: { activeGroupId: string } = { activeGroupId: '' }
  const botInboxId = deps.xmtp.inboxId

  const unsubGroup = deps.groupSubscriber.subscribe(roomKey, (gw) => {
    void onGroupWindow(gw)
  })

  async function onGroupWindow(gw: GroupWindow | null): Promise<void> {
    if (gw === null) {
      state.activeGroupId = ''
      deps.cfg.log('[shoutbox-bot] no active group window')
      return
    }
    state.activeGroupId = gw.groupId
    deps.cfg.log(
      `[shoutbox-bot] group ${gw.groupId.slice(0, 8)}… epoch=${gw.epoch}`,
    )
    await deps.xmtp.syncAllowedConversations()
  }

  const stopPresence = deps.presence.start(roomKey, botInboxId, deps.cfg.botEthereumAddress)

  const stream = await deps.xmtp.startAllMessagesStream({
    onMessage: (msg) => {
      void handleIncoming(msg)
    },
    onError: (err) => {
      deps.cfg.log(`[shoutbox-bot] stream error: ${err.message}`)
    },
  })

  async function handleIncoming(msg: DecodedMessage): Promise<void> {
    const text = textFromDecodedMessage(msg)
    if (text === null) return
    if (
      !shouldProcessShoutboxMessage(msg, {
        conversationId: msg.conversationId,
        activeGroupId: state.activeGroupId,
        senderInboxId: msg.senderInboxId,
        botInboxId,
      })
    ) {
      return
    }
    let ctx: ShoutboxReplyContext
    try {
      const snap = await deps.xmtp.fetchGroupChatContext(
        state.activeGroupId,
        deps.cfg.contextMessageLimit,
      )
      ctx = {
        memberInboxIds: snap.memberInboxIds,
        textMessages: mergeTriggerIntoTranscript(snap.textMessages, {
          id: msg.id,
          senderInboxId: msg.senderInboxId,
          content: text,
          sentAtMs: msg.sentAt.getTime(),
        }),
        botInboxId,
        trigger: {
          id: msg.id,
          senderInboxId: msg.senderInboxId,
          content: text,
          sentAtMs: msg.sentAt.getTime(),
        },
      }
    } catch (e) {
      const msgErr = e instanceof Error ? e.message : String(e)
      deps.cfg.log(`[shoutbox-bot] context fetch failed: ${msgErr}`)
      return
    }
    let reply: string
    try {
      reply = await deps.cfg.formatReply(ctx)
    } catch (e) {
      const msgErr = e instanceof Error ? e.message : String(e)
      deps.cfg.log(`[shoutbox-bot] reply failed: ${msgErr}`)
      return
    }
    try {
      await deps.xmtp.sendGroupText(state.activeGroupId, reply)
    } catch (e) {
      const msgErr = e instanceof Error ? e.message : String(e)
      deps.cfg.log(`[shoutbox-bot] send failed: ${msgErr}`)
    }
  }

  return {
    stop: async () => {
      stopPresence()
      unsubGroup()
      await stream.close()
    },
  }
}
