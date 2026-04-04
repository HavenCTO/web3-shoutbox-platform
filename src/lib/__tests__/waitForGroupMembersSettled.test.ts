import { describe, it, expect, vi, afterEach } from 'vitest'
import { waitForGroupMembersSettled } from '@/lib/waitForGroupMembersSettled'

/** Lets `sleep()` in the implementation (setTimeout) run under real timers. */
function flushTimerTick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

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
  maxTotalWaitMs: 999_999,
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('waitForGroupMembersSettled', () => {
  it('returns cancelled when cancelled before work', async () => {
    const { group } = createGroupMock([[{ inboxId: 'a' }]])
    await expect(
      waitForGroupMembersSettled(group, () => ['a'], () => true, fastOpts),
    ).resolves.toEqual({ ok: false, reason: 'cancelled' })
  })

  it('returns sync_error when sync throws', async () => {
    const sync = vi.fn().mockRejectedValue(new Error('fail'))
    const members = vi.fn()
    await expect(
      waitForGroupMembersSettled({ sync, members }, () => ['a'], () => false, fastOpts),
    ).resolves.toEqual({ ok: false, reason: 'sync_error' })
    expect(members).not.toHaveBeenCalled()
  })

  it('returns ok when required inboxes are present and fingerprint is stable', async () => {
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
    await flushTimerTick()
    advance()
    await flushTimerTick()
    advance()
    await flushTimerTick()
    await expect(p).resolves.toEqual({ ok: true })
  })

  it('returns timeout when required inbox never appears within attempts', async () => {
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
      await flushTimerTick()
      advance()
    }
    await expect(p).resolves.toEqual({ ok: false, reason: 'timeout' })
  })

  it('uses at least one member when required list is empty', async () => {
    const { group, advance } = createGroupMock([
      [{ inboxId: 'solo' }],
      [{ inboxId: 'solo' }],
    ])
    const p = waitForGroupMembersSettled(group, () => [], () => false, fastOpts)
    await flushTimerTick()
    advance()
    await flushTimerTick()
    await expect(p).resolves.toEqual({ ok: true })
  })

  it('returns timeout when a required inbox is missing even if fingerprint is stable', async () => {
    const { group, advance } = createGroupMock([
      [{ inboxId: 'a' }, { inboxId: 'b' }],
      [{ inboxId: 'a' }, { inboxId: 'b' }],
    ])
    const p = waitForGroupMembersSettled(
      group,
      () => ['a', 'b', 'c'],
      () => false,
      { ...fastOpts, maxAttempts: 4 },
    )
    for (let i = 0; i < 5; i++) {
      await flushTimerTick()
      advance()
    }
    await expect(p).resolves.toEqual({ ok: false, reason: 'timeout' })
  })

  it('returns timeout when maxTotalWaitMs is reached before maxAttempts', async () => {
    const { group } = createGroupMock([[{ inboxId: 'a' }]])
    await expect(
      waitForGroupMembersSettled(
        group,
        () => ['z'],
        () => false,
        {
          ...fastOpts,
          maxAttempts: 99,
          maxTotalWaitMs: 0,
          pollIntervalMs: 0,
        },
      ),
    ).resolves.toEqual({ ok: false, reason: 'timeout' })
  })

  it('logs roster vs presence in dev on timeout', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const { group } = createGroupMock([[{ inboxId: 'a' }]])
    await expect(
      waitForGroupMembersSettled(
        group,
        () => ['x'],
        () => false,
        {
          ...fastOpts,
          maxAttempts: 1,
          maxTotalWaitMs: 999_999,
        },
      ),
    ).resolves.toEqual({ ok: false, reason: 'timeout' })

    if (import.meta.env.DEV) {
      expect(debugSpy).toHaveBeenCalledWith(
        '[waitForGroupMembersSettled] roster vs presence (last attempt before fail)',
        expect.objectContaining({
          requiredInboxCount: 1,
          uniqueMemberInboxCount: 1,
        }),
      )
    } else {
      expect(debugSpy).not.toHaveBeenCalled()
    }
  })
})
