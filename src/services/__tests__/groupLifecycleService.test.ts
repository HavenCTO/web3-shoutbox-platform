import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/group-lifecycle', () => ({
  readCurrentGroup: vi.fn(),
  writeGroupToGunDB: vi.fn(),
  subscribeToGroup: vi.fn(),
}))

vi.mock('@/lib/gun', () => ({
  GUN_NAMESPACE: 'shoutbox-v1',
}))

vi.mock('@/services/messagingService', () => ({
  createGroup: vi.fn(),
  addMembersToGroup: vi.fn(),
}))

import { isGroupExpired, calculateNextEpoch } from '@/services/groupLifecycleService'
import type { GroupWindow } from '@/types/group'

function makeWindow(overrides: Partial<GroupWindow> = {}): GroupWindow {
  return {
    groupId: 'test-group-id',
    epoch: 1,
    createdBy: 'leader-inbox-id',
    createdAt: Date.now() - 60_000,
    expiresAt: Date.now() + 240_000,
    windowMinutes: 5,
    ...overrides,
  }
}

describe('isGroupExpired', () => {
  it('returns false for an active window', () => {
    expect(isGroupExpired(makeWindow({ expiresAt: Date.now() + 60_000 }))).toBe(false)
  })

  it('returns true for an expired window', () => {
    expect(isGroupExpired(makeWindow({ expiresAt: Date.now() - 1 }))).toBe(true)
  })

  it('returns true when expiresAt is in the past by 1ms', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    expect(isGroupExpired(makeWindow({ expiresAt: 1000 }))).toBe(false)
    vi.setSystemTime(1001)
    expect(isGroupExpired(makeWindow({ expiresAt: 1000 }))).toBe(true)
    vi.useRealTimers()
  })
})

describe('calculateNextEpoch', () => {
  it('increments the epoch by 1', () => {
    expect(calculateNextEpoch(0)).toBe(1)
    expect(calculateNextEpoch(41)).toBe(42)
  })
})
