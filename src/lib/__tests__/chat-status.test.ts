import { describe, it, expect } from 'vitest'
import {
  getChatStatusPresentation,
  shouldShowChatConnectingBanner,
  getChatConnectingBannerText,
  CHAT_CONNECTING_BANNER_TEXT,
} from '@/lib/chat-status'
import type { GroupState } from '@/types/group'
import type { ConnectionStep } from '@/lib/chat-status'

function pres(
  groupState: GroupState,
  overrides: {
    onlineCount?: number
    hasConversationError?: boolean
    isMessagingReady?: boolean
    isLoadingConversation?: boolean
    connectionStep?: ConnectionStep | null
    isAutoRecovering?: boolean
  } = {},
) {
  return getChatStatusPresentation({
    groupState,
    onlineCount: overrides.onlineCount ?? 2,
    hasConversationError: overrides.hasConversationError ?? false,
    isMessagingReady: overrides.isMessagingReady ?? false,
    isLoadingConversation: overrides.isLoadingConversation ?? false,
    connectionStep: overrides.connectionStep ?? null,
    isAutoRecovering: overrides.isAutoRecovering ?? false,
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

  it('shows reconnecting when there is a conversation error', () => {
    const r = pres('active', { hasConversationError: true, isMessagingReady: false })
    expect(r.statusText).toBe('Reconnecting…')
    expect(r.dotClassName).toContain('amber')
  })

  // Progressive connection step tests
  it('shows waiting-in-queue step', () => {
    const r = pres('active', { connectionStep: 'waiting-in-queue' })
    expect(r.statusText).toBe('In queue — session connecting…')
    expect(r.dotClassName).toContain('sky')
  })

  it('shows finding peers step', () => {
    const r = pres('active', { connectionStep: 'finding-peers' })
    expect(r.statusText).toBe('Finding peers…')
    expect(r.dotClassName).toContain('sky')
  })

  it('shows establishing encryption step', () => {
    const r = pres('active', { connectionStep: 'establishing-encryption' })
    expect(r.statusText).toBe('Establishing encrypted channel…')
  })

  it('shows syncing members step', () => {
    const r = pres('active', { connectionStep: 'syncing-members' })
    expect(r.statusText).toBe('Syncing group members…')
  })

  it('shows syncing history step', () => {
    const r = pres('active', { connectionStep: 'syncing-history' })
    expect(r.statusText).toBe('Loading message history…')
  })

  it('shows finalizing step', () => {
    const r = pres('active', { connectionStep: 'finalizing' })
    expect(r.statusText).toBe('Almost ready…')
  })

  // Auto-recovery tests
  it('shows syncing encryption state when auto-recovering', () => {
    const r = pres('active', { isAutoRecovering: true, hasConversationError: false })
    expect(r.statusText).toBe('Syncing encryption state…')
    expect(r.dotClassName).toContain('sky')
  })

  it('shows syncing encryption state even with error when auto-recovering', () => {
    const r = pres('active', { isAutoRecovering: true, hasConversationError: true })
    expect(r.statusText).toBe('Syncing encryption state…')
    expect(r.dotClassName).toContain('sky')
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

  it('is false when auto-recovering', () => {
    expect(
      shouldShowChatConnectingBanner({
        groupState: 'active',
        isMessagingReady: false,
        hasConversationError: false,
        isAutoRecovering: true,
      }),
    ).toBe(false)
  })

  it('exports deprecated banner copy', () => {
    expect(CHAT_CONNECTING_BANNER_TEXT.length).toBeGreaterThan(20)
  })
})

describe('getChatConnectingBannerText', () => {
  it('returns step-specific text for waiting-in-queue', () => {
    expect(getChatConnectingBannerText('waiting-in-queue')).toContain('queue')
  })

  it('returns step-specific text for finding-peers', () => {
    expect(getChatConnectingBannerText('finding-peers')).toContain('Finding peers')
  })

  it('returns step-specific text for establishing-encryption', () => {
    expect(getChatConnectingBannerText('establishing-encryption')).toContain('encryption')
  })

  it('returns step-specific text for syncing-members', () => {
    expect(getChatConnectingBannerText('syncing-members')).toContain('membership')
  })

  it('returns step-specific text for syncing-history', () => {
    expect(getChatConnectingBannerText('syncing-history')).toContain('history')
  })

  it('returns step-specific text for finalizing', () => {
    expect(getChatConnectingBannerText('finalizing')).toContain('Almost ready')
  })

  it('returns default text for null step', () => {
    const text = getChatConnectingBannerText(null)
    expect(text).toContain('Encrypted chat is still connecting')
  })
})
