import {
  Client,
  ConsentState,
  isText,
  MessageSortBy,
  SortDirection,
  type DecodedMessage,
  type Conversation,
} from '@xmtp/node-sdk'
import type { TextMessageRow } from './shoutboxContext.js'

export interface ShoutboxXmtpPort {
  readonly inboxId: string
  /** Sync all conversations and auto-allow any that are not yet allowed. */
  syncAllowedConversations(): Promise<void>
  startAllMessagesStream(handlers: {
    onMessage: (msg: DecodedMessage) => void
    onError: (err: Error) => void
  }): Promise<{ close: () => Promise<void> }>
  fetchGroupChatContext(groupId: string, limit: number): Promise<{
    memberInboxIds: readonly string[]
    textMessages: readonly TextMessageRow[]
  }>
  sendGroupText(groupId: string, text: string): Promise<void>
}

export function createShoutboxXmtpPort(client: Client, log?: (line: string) => void): ShoutboxXmtpPort {
  const inboxId = client.inboxId ?? ''

  /** Auto-allow any conversations that aren't in the Allowed state yet. */
  async function autoConsentAll(): Promise<void> {
    // Sync conversations across ALL consent states so we discover groups we've been added to
    await client.conversations.sync()
    const allConvos: Conversation[] = await client.conversations.list()
    for (const convo of allConvos) {
      try {
        const state = convo.consentState()
        if (state !== ConsentState.Allowed) {
          await convo.updateConsentState(ConsentState.Allowed)
          if (log) log(`[shoutbox-bot] auto-allowed conversation ${convo.id.slice(0, 8)}…`)
        }
      } catch (e) {
        if (log) log(`[shoutbox-bot] consent update error: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  return {
    inboxId,
    async syncAllowedConversations() {
      await autoConsentAll()
    },
    async startAllMessagesStream(handlers) {
      // Listen to ALL consent states — we auto-allow above, but new groups
      // may arrive between consent sweeps.  Listening to Unknown ensures
      // the bot sees messages immediately.
      const stream = await client.conversations.streamAllMessages({
        consentStates: [ConsentState.Allowed, ConsentState.Unknown],
        onValue: (m) => {
          handlers.onMessage(m)
        },
        onError: handlers.onError,
      })
      return {
        close: async () => {
          await stream.end()
        },
      }
    },
    async fetchGroupChatContext(groupId, limit) {
      const conv = await client.conversations.getConversationById(groupId)
      if (conv === undefined) {
        throw new Error(`XMTP conversation not found: ${groupId}`)
      }
      await conv.sync()
      const members = await conv.members()
      const memberInboxIds = members.map((m) => m.inboxId)
      const decoded = await conv.messages({
        limit,
        sortBy: MessageSortBy.SentAt,
        direction: SortDirection.Descending,
      })
      const textMessages: TextMessageRow[] = decoded
        .filter((m): m is DecodedMessage<string> => isText(m) && typeof m.content === 'string')
        .map((m) => ({
          id: m.id,
          senderInboxId: m.senderInboxId,
          content: m.content as string,
          sentAtMs: m.sentAt.getTime(),
        }))
      textMessages.reverse()
      return { memberInboxIds, textMessages }
    },
    async sendGroupText(groupId, text) {
      const conv = await client.conversations.getConversationById(groupId)
      if (conv === undefined) {
        throw new Error(`XMTP conversation not found: ${groupId}`)
      }
      await conv.sendText(text)
    },
  }
}
