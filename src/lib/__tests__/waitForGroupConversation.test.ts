import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  waitForGroupConversation,
  sleep,
  DEFAULT_WAIT_FOR_GROUP_OPTIONS,
} from '@/lib/waitForGroupConversation'
import type { Client } from '@xmtp/browser-sdk'

function createMockClient(
  results: Array<unknown>,
): { client: Client; sync: ReturnType<typeof vi.fn>; getById: ReturnType<typeof vi.fn> } {
  let i = 0
  const sync = vi.fn().mockResolvedValue(undefined)
  const getById = vi.fn().mockImplementation(() => {
    const v = results[Math.min(i, results.length - 1)]
    i += 1
    return Promise.resolve(v)
  })
  const client = {
    conversations: { sync, getConversationById: getById },
  } as unknown as Client
  return { client, sync, getById }
}

describe('sleep', () => {
  it('resolves after the given delay', async () => {
    vi.useFakeTimers()
    const p = sleep(1000)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(p).resolves.toBeUndefined()
    vi.useRealTimers()
  })
})

describe('waitForGroupConversation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the group on the first successful getConversationById', async () => {
    const group = { id: 'g1' }
    const { client, sync, getById } = createMockClient([group])
    const cancel = () => false

    const p = waitForGroupConversation(
      client,
      'gid',
      { maxAttempts: 5, initialDelayMs: 100, maxDelayMs: 500 },
      cancel,
    )

    await vi.runAllTimersAsync()
    await expect(p).resolves.toBe(group)
    expect(sync).toHaveBeenCalled()
    expect(getById).toHaveBeenCalledWith('gid')
  })

  it('retries after null until the group appears', async () => {
    const group = { id: 'g1' }
    const { client, getById } = createMockClient([null, null, group])
    const cancel = () => false

    const opts = { maxAttempts: 8, initialDelayMs: 50, maxDelayMs: 200 }
    const p = waitForGroupConversation(client, 'gid', opts, cancel)

    await vi.runAllTimersAsync()
    await expect(p).resolves.toBe(group)
    expect(getById).toHaveBeenCalledTimes(3)
  })

  it('returns null when cancelled', async () => {
    const { client } = createMockClient([null, null, null])
    let cancelled = false
    const cancel = () => cancelled

    const p = waitForGroupConversation(
      client,
      'gid',
      { maxAttempts: 10, initialDelayMs: 50, maxDelayMs: 200 },
      cancel,
    )

    await vi.advanceTimersByTimeAsync(30)
    cancelled = true
    await vi.runAllTimersAsync()
    await expect(p).resolves.toBeNull()
  })

  it('returns null after maxAttempts when the group never appears', async () => {
    const { client, getById } = createMockClient([null])
    const cancel = () => false

    const p = waitForGroupConversation(
      client,
      'gid',
      { maxAttempts: 3, initialDelayMs: 10, maxDelayMs: 20 },
      cancel,
    )

    await vi.runAllTimersAsync()
    await expect(p).resolves.toBeNull()
    expect(getById).toHaveBeenCalledTimes(3)
  })

  it('uses DEFAULT_WAIT_FOR_GROUP_OPTIONS shape', () => {
    expect(DEFAULT_WAIT_FOR_GROUP_OPTIONS.maxAttempts).toBeGreaterThan(0)
    expect(DEFAULT_WAIT_FOR_GROUP_OPTIONS.initialDelayMs).toBeGreaterThan(0)
    expect(DEFAULT_WAIT_FOR_GROUP_OPTIONS.maxDelayMs).toBeGreaterThanOrEqual(
      DEFAULT_WAIT_FOR_GROUP_OPTIONS.initialDelayMs,
    )
  })
})
