import { describe, it, expect } from 'vitest'
import { getOnlineUsers } from '@/services/presenceService'
import type { GunPresenceData } from '@/lib/gun-presence'

describe('getOnlineUsers', () => {
  it('sorts by inboxId for stable UI order (not by lastSeen)', () => {
    const now = Date.now()
    const records = new Map<string, GunPresenceData>([
      [
        'z',
        {
          inboxId: 'zzzz',
          address: '0xbbb',
          ts: now,
          status: 'online',
        },
      ],
      [
        'a',
        {
          inboxId: 'aaaa',
          address: '0xaaa',
          ts: now - 5000,
          status: 'online',
        },
      ],
      [
        'm',
        {
          inboxId: 'mmmm',
          address: '0xccc',
          ts: now - 20_000,
          status: 'online',
        },
      ],
    ])

    const users = getOnlineUsers(records)
    expect(users.map((u) => u.inboxId)).toEqual(['aaaa', 'mmmm', 'zzzz'])
  })

  it('excludes stale records beyond TTL', () => {
    const now = Date.now()
    const records = new Map<string, GunPresenceData>([
      [
        'fresh',
        { inboxId: 'a', address: '0x1', ts: now - 1000, status: 'online' },
      ],
      [
        'stale',
        { inboxId: 'b', address: '0x2', ts: now - 999_999, status: 'online' },
      ],
    ])

    const users = getOnlineUsers(records, 30_000)
    expect(users).toHaveLength(1)
    expect(users[0].inboxId).toBe('a')
  })
})
