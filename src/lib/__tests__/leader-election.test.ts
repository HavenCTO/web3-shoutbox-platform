import { describe, it, expect } from 'vitest'
import { electLeader, amILeader } from '@/lib/leader-election'
import type { OnlineUser } from '@/types/presence'

function user(inboxId: string, isOnline = true): OnlineUser {
  return { inboxId, address: `0x${inboxId}`, lastSeen: Date.now(), isOnline }
}

describe('electLeader', () => {
  it('returns the lexicographically lowest inbox ID', () => {
    const users = [user('ccc'), user('aaa'), user('bbb')]
    expect(electLeader(users)).toBe('aaa')
  })

  it('returns null for an empty list', () => {
    expect(electLeader([])).toBeNull()
  })

  it('returns the single user when only one is online', () => {
    expect(electLeader([user('xyz')])).toBe('xyz')
  })

  it('ignores offline users', () => {
    const users = [user('aaa', false), user('bbb', true), user('ccc', true)]
    expect(electLeader(users)).toBe('bbb')
  })

  it('returns null when all users are offline', () => {
    const users = [user('aaa', false), user('bbb', false)]
    expect(electLeader(users)).toBeNull()
  })

  it('is deterministic — same input always produces same output', () => {
    const users = [user('fff'), user('ddd'), user('eee')]
    const a = electLeader(users)
    const b = electLeader(users)
    expect(a).toBe(b)
    expect(a).toBe('ddd')
  })

  it('handles SHA-256-like inbox IDs correctly', () => {
    const users = [
      user('b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3'),
      user('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'),
    ]
    expect(electLeader(users)).toBe(
      'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    )
  })
})

describe('amILeader', () => {
  it('returns true when my inbox ID is the lowest', () => {
    const users = [user('bbb'), user('aaa'), user('ccc')]
    expect(amILeader('aaa', users)).toBe(true)
  })

  it('returns false when my inbox ID is not the lowest', () => {
    const users = [user('bbb'), user('aaa'), user('ccc')]
    expect(amILeader('bbb', users)).toBe(false)
  })

  it('returns false when user list is empty', () => {
    expect(amILeader('aaa', [])).toBe(false)
  })
})
