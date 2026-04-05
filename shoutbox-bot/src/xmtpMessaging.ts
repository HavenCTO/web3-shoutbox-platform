import {
  Client,
  ConsentState,
  isText,
  MessageSortBy,
  SortDirection,
  type DecodedMessage,
} from '@xmtp/node-sdk'
import type { TextMessageRow } from './shoutboxContext.js'

export interface ShoutboxXmtpPort {
  readonly inboxId: string
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

export function createShoutboxXmtpPort(client: Client): ShoutboxXmtpPort {
  const inboxId = client.inboxId ?? ''
  return {
    inboxId,
    syncAllowedConversations() {
      return client.conversations
        .syncAll([ConsentState.Allowed])
        .then(() => undefined)
    },
    async startAllMessagesStream(handlers) {
      const stream = await client.conversations.streamAllMessages({
        consentStates: [ConsentState.Allowed],
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
          content: m.content,
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
