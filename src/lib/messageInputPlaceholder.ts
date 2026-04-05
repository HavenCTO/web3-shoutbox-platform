import type { ConnectionStep } from '@/lib/chat-status'
import type { GroupState } from '@/types/group'

export interface MessageInputPlaceholderParams {
  isConnected: boolean
  xmtpReady: boolean
  groupState: GroupState
  messagingReady: boolean
  allowQueueing: boolean
  connectionStep: ConnectionStep | null | undefined
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
    connectionStep,
  } = params
  if (!isConnected) return 'Connect wallet to chat'
  if (!xmtpReady) return 'Setting up messaging…'
  if (groupState !== 'active' && groupState !== 'expiring') return 'Waiting for session…'
  if (!messagingReady && allowQueueing) {
    if (connectionStep === 'waiting-in-queue') {
      return 'In queue — type a message; it sends when the session is ready…'
    }
    return 'Type a message — it will send when connected…'
  }
  if (!messagingReady) return 'Connecting to encrypted chat…'
  return 'Type a message…'
}
