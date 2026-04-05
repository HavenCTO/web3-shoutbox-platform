import type { GroupState } from '@/types/group'

export type ConnectionStep =
  | 'finding-peers'
  | 'establishing-encryption'
  | 'syncing-members'
  | 'syncing-history'
  | 'finalizing'
  | 'ready'

export interface ChatStatusPresentationInput {
  groupState: GroupState
  onlineCount: number
  hasConversationError: boolean
  isMessagingReady: boolean
  isLoadingConversation: boolean
  /** Optional granular connection step for progressive indicator */
  connectionStep?: ConnectionStep | null
  /** True when a transient MLS error is auto-recovering (not a hard failure) */
  isAutoRecovering?: boolean
}

/**
 * Status dot + label for the chat header. Separates "session active" from "encrypted chat ready".
 * Now includes progressive connection steps for better UX during the connection phase.
 */
export function getChatStatusPresentation(
  input: ChatStatusPresentationInput,
): { dotClassName: string; statusText: string } {
  const {
    groupState,
    onlineCount,
    hasConversationError,
    isMessagingReady,
    isLoadingConversation,
    connectionStep,
    isAutoRecovering,
  } = input
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

  // Auto-recovering from transient MLS error — show soft status instead of hard error
  if (sessionLive && isAutoRecovering) {
    return { dotClassName: 'bg-sky-500 animate-pulse', statusText: 'Syncing encryption state…' }
  }

  if (sessionLive && hasConversationError) {
    return { dotClassName: 'bg-amber-500 animate-pulse', statusText: 'Reconnecting…' }
  }

  if (sessionLive && (!isMessagingReady || isLoadingConversation)) {
    const stepText = getConnectionStepText(connectionStep ?? null)
    return {
      dotClassName: 'bg-sky-500 animate-pulse',
      statusText: stepText,
    }
  }

  if (sessionLive && isMessagingReady) {
    return { dotClassName: 'bg-green-500', statusText: `Connected · ${onlineCount} online` }
  }

  return { dotClassName: 'bg-amber-500 animate-pulse', statusText: 'Connecting…' }
}

function getConnectionStepText(step: ConnectionStep | null): string {
  switch (step) {
    case 'finding-peers':
      return 'Finding peers…'
    case 'establishing-encryption':
      return 'Establishing encrypted channel…'
    case 'syncing-members':
      return 'Syncing group members…'
    case 'syncing-history':
      return 'Loading message history…'
    case 'finalizing':
      return 'Almost ready…'
    default:
      return 'Connecting to encrypted chat…'
  }
}

/** Neutral info strip while the session is live but MLS chat is not ready yet. */
export function shouldShowChatConnectingBanner(input: {
  groupState: GroupState
  isMessagingReady: boolean
  hasConversationError: boolean
  isAutoRecovering?: boolean
}): boolean {
  const sessionLive = input.groupState === 'active' || input.groupState === 'expiring'
  if (input.isAutoRecovering) return false
  return sessionLive && !input.hasConversationError && !input.isMessagingReady
}

export function getChatConnectingBannerText(step: ConnectionStep | null): string {
  switch (step) {
    case 'finding-peers':
      return 'Finding peers on the network…'
    case 'establishing-encryption':
      return 'Setting up end-to-end encryption — this may take a moment.'
    case 'syncing-members':
      return 'Syncing group membership — waiting for all participants.'
    case 'syncing-history':
      return 'Loading message history…'
    case 'finalizing':
      return 'Almost ready — finalizing encrypted connection.'
    default:
      return "You're in the room. Encrypted chat is still connecting — usually a few seconds."
  }
}

/** @deprecated Use getChatConnectingBannerText for step-aware text */
export const CHAT_CONNECTING_BANNER_TEXT =
  "You're in the room. Encrypted chat is still connecting — usually a few seconds."
