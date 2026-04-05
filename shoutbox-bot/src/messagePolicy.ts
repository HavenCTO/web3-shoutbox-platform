import { isText, type DecodedMessage } from '@xmtp/node-sdk'

export interface ShoutboxMessageCheck {
  conversationId: string
  activeGroupId: string
  senderInboxId: string
  botInboxId: string
}

/** Whether this decoded message should trigger a bot reply in the active shoutbox group. */
export function shouldProcessShoutboxMessage(
  msg: DecodedMessage,
  check: ShoutboxMessageCheck,
): boolean {
  if (check.activeGroupId === '') return false
  if (msg.conversationId !== check.activeGroupId) return false
  if (msg.senderInboxId === check.botInboxId) return false
  return isText(msg)
}

/** Plain text from a decoded message when content is text. */
export function textFromDecodedMessage(msg: DecodedMessage): string | null {
  if (!isText(msg)) return null
  if (typeof msg.content !== 'string') return null
  return msg.content
}
