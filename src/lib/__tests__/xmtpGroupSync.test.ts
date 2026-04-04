import { describe, it, expect, vi } from 'vitest'
import { syncGroupForMessaging } from '@/lib/xmtpGroupSync'

describe('syncGroupForMessaging', () => {
  it('returns false immediately when already cancelled', async () => {
    const sync = vi.fn()
    await expect(
      syncGroupForMessaging({ sync }, () => true),
    ).resolves.toBe(false)
    expect(sync).not.toHaveBeenCalled()
  })

  it('returns true when sync succeeds and not cancelled', async () => {
    const sync = vi.fn().mockResolvedValue(undefined)
    await expect(
      syncGroupForMessaging({ sync }, () => false),
    ).resolves.toBe(true)
    expect(sync).toHaveBeenCalledTimes(1)
  })

  it('returns false when sync rejects', async () => {
    const sync = vi.fn().mockRejectedValue(new Error('network'))
    await expect(
      syncGroupForMessaging({ sync }, () => false),
    ).resolves.toBe(false)
  })

  it('returns false when cancelled after sync resolves', async () => {
    let cancelled = false
    const sync = vi.fn().mockImplementation(async () => {
      cancelled = true
    })
    await expect(
      syncGroupForMessaging({ sync }, () => cancelled),
    ).resolves.toBe(false)
  })
})
