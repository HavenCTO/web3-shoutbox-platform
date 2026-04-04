import type { GroupState } from '@/types/group'

export interface ChatStatusPresentationInput {
  groupState: GroupState
  onlineCount: number
  hasConversationError: boolean
  isMessagingReady: boolean
  isLoadingConversation: boolean
}

/**
 * Status dot + label for the chat header. Separates “session active” from “encrypted chat ready”.
 */
export function getChatStatusPresentation(
  input: ChatStatusPresentationInput,
): { dotClassName: string; statusText: string } {
  const { groupState, onlineCount, hasConversationError, isMessagingReady, isLoadingConversation } =
    input
  const sessionLive = groupState === 'active' || groupState === 'expiring'

  if (groupState === 'transitioning') {
    return { dotClassName: 'bg-amber-500 animate-pulse', statusText: 'Switching sessions…' }
  }
  if (groupState === 'waiting-for-group') {
    return { dotClassName: 'bg-amber-500 animate-pulse', statusText: 'Setting up chat room…' }
  }
  if (groupState === 'idle') {
    return { dotClassName: 'bg-amber-500 animate-pulse', statusText: 'Connecting…' }
  }

  if (sessionLive && hasConversationError) {
    return { dotClassName: 'bg-amber-500 animate-pulse', statusText: 'Chat unavailable' }
  }

  if (sessionLive && (!isMessagingReady || isLoadingConversation)) {
    return {
      dotClassName: 'bg-sky-500 animate-pulse',
      statusText: 'Connecting to encrypted chat…',
    }
  }

  if (sessionLive && isMessagingReady) {
    return { dotClassName: 'bg-green-500', statusText: `Connected · ${onlineCount} online` }
  }

  return { dotClassName: 'bg-amber-500 animate-pulse', statusText: 'Connecting…' }
}

/** Neutral info strip while the session is live but MLS chat is not ready yet. */
export function shouldShowChatConnectingBanner(input: {
  groupState: GroupState
  isMessagingReady: boolean
  hasConversationError: boolean
}): boolean {
  const sessionLive = input.groupState === 'active' || input.groupState === 'expiring'
  return sessionLive && !input.hasConversationError && !input.isMessagingReady
}

export const CHAT_CONNECTING_BANNER_TEXT =
  "You're in the room. Encrypted chat is still connecting — usually a few seconds."
