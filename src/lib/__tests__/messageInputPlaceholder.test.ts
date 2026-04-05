import { describe, it, expect } from 'vitest'
import { getMessageInputPlaceholder } from '@/lib/messageInputPlaceholder'

const base = {
  isConnected: true,
  xmtpReady: true,
  groupState: 'active' as const,
  messagingReady: false,
  allowQueueing: true,
  queuedMessageCount: 0,
}

describe('getMessageInputPlaceholder', () => {
  it('asks to connect when wallet disconnected', () => {
    expect(
      getMessageInputPlaceholder({ ...base, isConnected: false }),
    ).toBe('Connect wallet to chat')
  })

  it('shows XMTP setup when wallet connected but XMTP not ready', () => {
    expect(
      getMessageInputPlaceholder({ ...base, xmtpReady: false }),
    ).toBe('Setting up messaging…')
  })

  it('shows session wait when group not active', () => {
    expect(
      getMessageInputPlaceholder({ ...base, groupState: 'waiting-for-group' }),
    ).toBe('Waiting for session…')
  })

  it('uses queue copy when messages are queued with allowQueueing', () => {
    expect(
      getMessageInputPlaceholder({
        ...base,
        queuedMessageCount: 1,
      }),
    ).toBe('In queue — type a message; it sends when the session is ready…')
  })

  it('uses generic queue copy when nothing is queued', () => {
    expect(
      getMessageInputPlaceholder({
        ...base,
        queuedMessageCount: 0,
      }),
    ).toBe('Type a message — it will send when connected…')
  })

  it('shows connecting when not messaging ready and queueing disabled', () => {
    expect(
      getMessageInputPlaceholder({
        ...base,
        allowQueueing: false,
        queuedMessageCount: 1,
      }),
    ).toBe('Connecting to encrypted chat…')
  })

  it('shows normal placeholder when messaging ready', () => {
    expect(
      getMessageInputPlaceholder({ ...base, messagingReady: true }),
    ).toBe('Type a message…')
  })
})
