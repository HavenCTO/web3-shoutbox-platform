/**
 * Tests for the deferred MLS group creation gate, debounce constants,
 * and latch semantics introduced in the "Deferred MLS Group Creation" plan.
 */

import { describe, it, expect, vi } from 'vitest'

// Mock transitive dependencies that trigger env validation at import time
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

import {
  shouldDeferGroupCreation,
  gateNeedsDebounce,
  isGroupOrphaned,
  countDistinctOnlineInboxes,
  MIN_PARTICIPANTS,
  CREATION_GATE_DEBOUNCE_MS,
} from '@/services/groupLifecycleService'
import type { OnlineUser } from '@/types/presence'
import type { GroupWindow } from '@/types/group'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(inboxId: string, isOnline = true): OnlineUser {
  return {
    inboxId,
    address: `0x${inboxId}`,
    lastSeen: Date.now(),
    isOnline,
  }
}

// ── shouldDeferGroupCreation ─────────────────────────────────────────────────

describe('shouldDeferGroupCreation', () => {
  it('defers when there are zero online users', () => {
    expect(shouldDeferGroupCreation([], null, false)).toBe(true)
  })

  it('defers when only one distinct online inbox exists (solo user)', () => {
    const users = [makeUser('inbox-a')]
    expect(shouldDeferGroupCreation(users, 'inbox-a', false)).toBe(true)
  })

  it('does NOT defer when two distinct online inboxes exist', () => {
    const users = [makeUser('inbox-a'), makeUser('inbox-b')]
    expect(shouldDeferGroupCreation(users, 'inbox-a', false)).toBe(false)
  })

  it('does NOT defer when three or more distinct online inboxes exist', () => {
    const users = [makeUser('inbox-a'), makeUser('inbox-b'), makeUser('inbox-c')]
    expect(shouldDeferGroupCreation(users, 'inbox-a', false)).toBe(false)
  })

  it('counts distinct inbox IDs (ignores duplicate inboxes from multi-tab)', () => {
    // Same user with two presence entries (two tabs)
    const users = [makeUser('inbox-a'), makeUser('inbox-a')]
    expect(shouldDeferGroupCreation(users, 'inbox-a', false)).toBe(true)
  })

  it('ignores offline users for the threshold', () => {
    const users = [
      makeUser('inbox-a', true),
      makeUser('inbox-b', false), // offline
    ]
    expect(shouldDeferGroupCreation(users, 'inbox-a', false)).toBe(true)
  })

  it('treats selfInboxId as irrelevant — only raw count matters', () => {
    // Even with null selfInboxId, the count of distinct inboxes decides
    const users = [makeUser('inbox-a'), makeUser('inbox-b')]
    expect(shouldDeferGroupCreation(users, null, false)).toBe(false)
  })

  // ── Latch semantics ──

  it('never defers once a group already exists (latch / hasExistingGroup)', () => {
    // Even with zero users, once latched the gate is permanently open
    expect(shouldDeferGroupCreation([], null, true)).toBe(false)
  })

  it('latch overrides even when only one user is online', () => {
    const users = [makeUser('inbox-a')]
    expect(shouldDeferGroupCreation(users, 'inbox-a', true)).toBe(false)
  })

  it('latch works with empty list too', () => {
    expect(shouldDeferGroupCreation([], 'inbox-a', true)).toBe(false)
  })
})

// ── countDistinctOnlineInboxes ───────────────────────────────────────────────

describe('countDistinctOnlineInboxes', () => {
  it('returns 0 for an empty list', () => {
    expect(countDistinctOnlineInboxes([])).toBe(0)
  })

  it('counts unique online users', () => {
    const users = [makeUser('a'), makeUser('b'), makeUser('c')]
    expect(countDistinctOnlineInboxes(users)).toBe(3)
  })

  it('deduplicates same inboxId', () => {
    const users = [makeUser('a'), makeUser('a'), makeUser('b')]
    expect(countDistinctOnlineInboxes(users)).toBe(2)
  })

  it('excludes offline users', () => {
    const users = [
      makeUser('a', true),
      makeUser('b', false),
      makeUser('c', true),
    ]
    expect(countDistinctOnlineInboxes(users)).toBe(2)
  })
})

// ── Constants validation ─────────────────────────────────────────────────────

describe('creation gate constants', () => {
  it('MIN_PARTICIPANTS is at least 2', () => {
    expect(MIN_PARTICIPANTS).toBeGreaterThanOrEqual(2)
  })

  it('CREATION_GATE_DEBOUNCE_MS is positive and > 10 seconds (heartbeat)', () => {
    expect(CREATION_GATE_DEBOUNCE_MS).toBeGreaterThan(10_000)
  })
})

// ── Standing bridge members ──────────────────────────────────────────────────

describe('standing bridge members', () => {
  const BRIDGE_ADDR = '0x90779a7582aafb91b9ad78e9f3a3cba88ed44042'

  it('does NOT defer a solo host when a bridge address will be seated', () => {
    const users = [makeUser('inbox-a')]
    expect(shouldDeferGroupCreation(users, 'inbox-a', false, [BRIDGE_ADDR])).toBe(false)
  })

  it('still defers a solo host without a bridge when no one else is online', () => {
    const users = [makeUser('inbox-a')]
    expect(shouldDeferGroupCreation(users, 'inbox-a', false, [])).toBe(true)
  })

  it('still defers when the bridge address duplicates the host address', () => {
    const users = [makeUser('inbox-a')]
    // makeUser address is `0x${inboxId}` = '0xinbox-a'
    expect(shouldDeferGroupCreation(users, 'inbox-a', false, ['0xinbox-a'])).toBe(true)
  })

  it('counts bridge addresses case-insensitively (no double-count)', () => {
    const users = [makeUser('inbox-a')]
    expect(
      shouldDeferGroupCreation(users, 'inbox-a', false, ['0XINBOX-A']),
    ).toBe(true)
  })

  it('zero online users still defers even with a bridge', () => {
    expect(shouldDeferGroupCreation([], null, false, [BRIDGE_ADDR])).toBe(true)
  })

  it('two hosts plus a bridge does NOT defer', () => {
    const users = [makeUser('inbox-a'), makeUser('inbox-b')]
    expect(shouldDeferGroupCreation(users, 'inbox-a', false, [BRIDGE_ADDR])).toBe(false)
  })
})

// ── gateNeedsDebounce ────────────────────────────────────────────────────────

describe('gateNeedsDebounce', () => {
  const BRIDGE_ADDR = '0x90779a7582aafb91b9ad78e9f3a3cba88ed44042'

  it('needs debounce when humans alone meet the gate', () => {
    const users = [makeUser('inbox-a'), makeUser('inbox-b')]
    expect(gateNeedsDebounce(users, [BRIDGE_ADDR])).toBe(true)
  })

  it('needs debounce when humans alone meet the gate (no bridge)', () => {
    const users = [makeUser('inbox-a'), makeUser('inbox-b')]
    expect(gateNeedsDebounce(users, [])).toBe(true)
  })

  it('skips debounce when the bridge completes the gate for a solo host', () => {
    const users = [makeUser('inbox-a')]
    expect(gateNeedsDebounce(users, [BRIDGE_ADDR])).toBe(false)
  })

  it('stays debounced when the gate is unmet even with the bridge', () => {
    expect(gateNeedsDebounce([], [BRIDGE_ADDR])).toBe(true)
  })

  it('stays debounced for a solo host without a bridge', () => {
    const users = [makeUser('inbox-a')]
    expect(gateNeedsDebounce(users, [])).toBe(true)
  })
})

// ── isGroupOrphaned ──────────────────────────────────────────────────────────

describe('isGroupOrphaned', () => {
  const win: GroupWindow = {
    groupId: 'g1',
    epoch: 1,
    createdBy: 'inbox-a',
    createdAt: 0,
    expiresAt: Number.MAX_SAFE_INTEGER,
    windowMinutes: 15,
  }

  it('is orphaned when the creator is offline', () => {
    expect(isGroupOrphaned(win, [makeUser('inbox-b')])).toBe(true)
  })

  it('is orphaned when nobody is online', () => {
    expect(isGroupOrphaned(win, [])).toBe(true)
  })

  it('is not orphaned while the creator is online', () => {
    expect(isGroupOrphaned(win, [makeUser('inbox-a'), makeUser('inbox-b')])).toBe(false)
  })

  it('ignores offline creator records', () => {
    const users = [makeUser('inbox-a', false)]
    expect(isGroupOrphaned(win, users)).toBe(true)
  })
})

// ── Edge case matrix from the plan ───────────────────────────────────────────

describe('edge case matrix', () => {
  it('solo user opens room → defers', () => {
    const users = [makeUser('solo')]
    expect(shouldDeferGroupCreation(users, 'solo', false)).toBe(true)
  })

  it('second user joins → gate passes', () => {
    const users = [makeUser('user-a'), makeUser('user-b')]
    expect(shouldDeferGroupCreation(users, 'user-a', false)).toBe(false)
  })

  it('count drops from 2→1 after group exists → NO teardown (latch)', () => {
    const users = [makeUser('user-a')]
    // hasExistingGroup = true → latch
    expect(shouldDeferGroupCreation(users, 'user-a', true)).toBe(false)
  })

  it('count drops to 0 after group exists → still no teardown (latch)', () => {
    expect(shouldDeferGroupCreation([], 'user-a', true)).toBe(false)
  })

  it('count flickers 1↔2 before group → each evaluation is independent (debounce logic is in hook)', () => {
    const oneUser = [makeUser('user-a')]
    const twoUsers = [makeUser('user-a'), makeUser('user-b')]
    // Without latch, the pure function simply evaluates current snapshot
    expect(shouldDeferGroupCreation(oneUser, 'user-a', false)).toBe(true)
    expect(shouldDeferGroupCreation(twoUsers, 'user-a', false)).toBe(false)
    expect(shouldDeferGroupCreation(oneUser, 'user-a', false)).toBe(true)
  })
})
