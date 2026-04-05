import type { GroupState } from '@/types/group'

export interface MessageInputPlaceholderParams {
  isConnected: boolean
  xmtpReady: boolean
  groupState: GroupState
  messagingReady: boolean
  allowQueueing: boolean
  /** When positive, show queue-specific placeholder while messaging is still connecting */
  queuedMessageCount?: number
}

/**
 * Placeholder copy for the shoutbox composer — queue-aware when MLS is still settling.
 */
export function getMessageInputPlaceholder(params: MessageInputPlaceholderParams): string {
  const {
    isConnected,
    xmtpReady,
    groupState,
    messagingReady,
    allowQueueing,
    queuedMessageCount = 0,
  } = params
  if (!isConnected) return 'Connect wallet to chat'
  if (!xmtpReady) return 'Setting up messaging…'
  if (groupState !== 'active' && groupState !== 'expiring') return 'Waiting for session…'
  if (!messagingReady && allowQueueing) {
    if (queuedMessageCount > 0) {
      return 'In queue — type a message; it sends when the session is ready…'
    }
    return 'Type a message — it will send when connected…'
  }
  if (!messagingReady) return 'Connecting to encrypted chat…'
  return 'Type a message…'
}
