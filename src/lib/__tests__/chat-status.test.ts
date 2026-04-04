import { describe, it, expect } from 'vitest'
import {
  getChatStatusPresentation,
  shouldShowChatConnectingBanner,
  CHAT_CONNECTING_BANNER_TEXT,
} from '@/lib/chat-status'
import type { GroupState } from '@/types/group'

function pres(
  groupState: GroupState,
  overrides: {
    onlineCount?: number
    hasConversationError?: boolean
    isMessagingReady?: boolean
    isLoadingConversation?: boolean
  } = {},
) {
  return getChatStatusPresentation({
    groupState,
    onlineCount: overrides.onlineCount ?? 2,
    hasConversationError: overrides.hasConversationError ?? false,
    isMessagingReady: overrides.isMessagingReady ?? false,
    isLoadingConversation: overrides.isLoadingConversation ?? false,
  })
}

describe('getChatStatusPresentation', () => {
  it('shows setup copy for waiting-for-group', () => {
    const r = pres('waiting-for-group')
    expect(r.statusText).toContain('Setting up')
    expect(r.dotClassName).toContain('amber')
  })

  it('shows encrypted chat connecting when session is active but chat not ready', () => {
    const r = pres('active', { isMessagingReady: false, isLoadingConversation: false })
    expect(r.statusText).toBe('Connecting to encrypted chat…')
    expect(r.dotClassName).toContain('sky')
  })

  it('shows encrypted chat connecting while conversation is loading', () => {
    const r = pres('active', { isMessagingReady: false, isLoadingConversation: true })
    expect(r.statusText).toBe('Connecting to encrypted chat…')
  })

  it('shows connected when messaging is ready', () => {
    const r = pres('active', { isMessagingReady: true, isLoadingConversation: false })
    expect(r.statusText).toBe('Connected · 2 online')
    expect(r.dotClassName).toContain('green')
  })

  it('shows chat unavailable when there is a conversation error', () => {
    const r = pres('active', { hasConversationError: true, isMessagingReady: false })
    expect(r.statusText).toBe('Chat unavailable')
  })
})

describe('shouldShowChatConnectingBanner', () => {
  it('is true when session is live, no error, chat not ready', () => {
    expect(
      shouldShowChatConnectingBanner({
        groupState: 'active',
        isMessagingReady: false,
        hasConversationError: false,
      }),
    ).toBe(true)
  })

  it('is false when messaging is ready', () => {
    expect(
      shouldShowChatConnectingBanner({
        groupState: 'active',
        isMessagingReady: true,
        hasConversationError: false,
      }),
    ).toBe(false)
  })

  it('is false when there is an error', () => {
    expect(
      shouldShowChatConnectingBanner({
        groupState: 'active',
        isMessagingReady: false,
        hasConversationError: true,
      }),
    ).toBe(false)
  })

  it('exports banner copy', () => {
    expect(CHAT_CONNECTING_BANNER_TEXT.length).toBeGreaterThan(20)
  })
})
