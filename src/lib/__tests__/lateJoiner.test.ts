import { describe, it, expect } from 'vitest'
import { newMemberAddresses } from '@/lib/lateJoiner'
import type { OnlineUser } from '@/types/presence'

function makeUser(address: string, isOnline = true): OnlineUser {
  return { inboxId: `inbox-${address}`, address, lastSeen: Date.now(), isOnline }
}

describe('newMemberAddresses', () => {
  it('returns online addresses lowercased and deduplicated', () => {
    const users = [makeUser('0xAAAA'), makeUser('0xaaaa'), makeUser('0xBBBB')]
    expect(newMemberAddresses(users, new Set())).toEqual(['0xaaaa', '0xbbbb'])
  })

  it('skips offline users', () => {
    const users = [makeUser('0xaaaa'), makeUser('0xbbbb', false)]
    expect(newMemberAddresses(users, new Set())).toEqual(['0xaaaa'])
  })

  it('skips already-attempted addresses', () => {
    const users = [makeUser('0xaaaa'), makeUser('0xbbbb')]
    expect(newMemberAddresses(users, new Set(['0xaaaa']))).toEqual(['0xbbbb'])
  })

  it('skips excluded standing bridges (case-insensitive)', () => {
    const users = [makeUser('0xAAAA'), makeUser('0xbbbb')]
    expect(newMemberAddresses(users, new Set(), ['0xaaaa'])).toEqual(['0xbbbb'])
  })

  it('returns empty when everyone is attempted', () => {
    const users = [makeUser('0xaaaa')]
    expect(newMemberAddresses(users, new Set(['0xaaaa']))).toEqual([])
  })
})
