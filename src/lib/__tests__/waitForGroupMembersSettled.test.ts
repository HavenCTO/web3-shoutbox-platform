import { describe, it, expect, vi } from 'vitest'
import { waitForGroupMembersSettled } from '@/lib/waitForGroupMembersSettled'

function createGroupMock(
  sequences: ReadonlyArray<ReadonlyArray<{ inboxId: string }>>,
): { group: { sync: ReturnType<typeof vi.fn>; members: ReturnType<typeof vi.fn> }; advance: () => void } {
  let i = 0
  const sync = vi.fn().mockResolvedValue(undefined)
  const members = vi.fn().mockImplementation(() => {
    const row = sequences[Math.min(i, sequences.length - 1)]
    return Promise.resolve([...row])
  })
  return {
    group: { sync, members },
    advance: () => {
      i += 1
    },
  }
}

const fastOpts = {
  maxAttempts: 20,
  pollIntervalMs: 0,
  requiredConsecutiveStable: 2,
  minTotalWaitMs: 0,
}

describe('waitForGroupMembersSettled', () => {
  it('returns false when cancelled before work', async () => {
    const { group } = createGroupMock([[{ inboxId: 'a' }]])
    await expect(
      waitForGroupMembersSettled(group, () => ['a'], () => true, fastOpts),
    ).resolves.toBe(false)
  })

  it('returns false when sync throws', async () => {
    const sync = vi.fn().mockRejectedValue(new Error('fail'))
    const members = vi.fn()
    await expect(
      waitForGroupMembersSettled({ sync, members }, () => ['a'], () => false, fastOpts),
    ).resolves.toBe(false)
    expect(members).not.toHaveBeenCalled()
  })

  it('returns true when required inboxes are present and fingerprint is stable', async () => {
    const seq = [
      [{ inboxId: 'a' }],
      [{ inboxId: 'a' }, { inboxId: 'b' }],
      [{ inboxId: 'a' }, { inboxId: 'b' }],
    ]
    const { group, advance } = createGroupMock(seq)
    const p = waitForGroupMembersSettled(
      group,
      () => ['a', 'b'],
      () => false,
      fastOpts,
    )
    await vi.advanceTimersByTimeAsync(0)
    advance()
    await vi.advanceTimersByTimeAsync(0)
    advance()
    await expect(p).resolves.toBe(true)
  })

  it('returns false when required inbox never appears', async () => {
    const { group, advance } = createGroupMock([
      [{ inboxId: 'a' }],
      [{ inboxId: 'a' }],
    ])
    const p = waitForGroupMembersSettled(
      group,
      () => ['a', 'missing'],
      () => false,
      { ...fastOpts, maxAttempts: 3 },
    )
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(0)
      advance()
    }
    await expect(p).resolves.toBe(false)
  })

  it('uses at least one member when required list is empty', async () => {
    const { group, advance } = createGroupMock([
      [{ inboxId: 'solo' }],
      [{ inboxId: 'solo' }],
    ])
    const p = waitForGroupMembersSettled(group, () => [], () => false, fastOpts)
    await vi.advanceTimersByTimeAsync(0)
    advance()
    await expect(p).resolves.toBe(true)
  })
})
