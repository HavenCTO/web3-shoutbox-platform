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
  countDistinctOnlineInboxes,
  MIN_PARTICIPANTS,
  CREATION_GATE_DEBOUNCE_MS,
} from '@/services/groupLifecycleService'
import type { OnlineUser } from '@/types/presence'

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
