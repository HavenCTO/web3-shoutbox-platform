import { describe, it, expect } from 'vitest'
import { addBatchAllowed, pruneAddTimestamps, MEMBER_ADD_HEAT_LIMITS } from '@/lib/memberAddHeat'

const L = { windowMs: 600_000, maxAdds: 3, minIntervalMs: 5_000 }

describe('pruneAddTimestamps', () => {
  it('drops entries older than the window', () => {
    expect(pruneAddTimestamps([0, 500_000, 599_999], 600_000, L)).toEqual([500_000, 599_999])
  })

  it('keeps everything inside the window', () => {
    expect(pruneAddTimestamps([1000, 2000], 3000, L)).toEqual([1000, 2000])
  })
})

describe('addBatchAllowed', () => {
  it('allows the first batch', () => {
    expect(addBatchAllowed([], 2, 100_000, L)).toBe(true)
  })

  it('blocks when the batch would exceed the window budget', () => {
    expect(addBatchAllowed([90_000, 95_000], 2, 100_000, L)).toBe(false)
  })

  it('allows a batch that exactly fills the budget', () => {
    expect(addBatchAllowed([90_000], 2, 100_000, L)).toBe(true)
  })

  it('blocks batches inside the minimum interval', () => {
    expect(addBatchAllowed([99_000], 1, 100_000, L)).toBe(false)
  })

  it('allows once cooled down and budget remains', () => {
    expect(addBatchAllowed([90_000], 1, 100_000, L)).toBe(true)
  })

  it('rejects empty batches', () => {
    expect(addBatchAllowed([], 0, 100_000, L)).toBe(false)
  })

  it('default limits are sane (20 adds / 10 min, 5s apart)', () => {
    expect(MEMBER_ADD_HEAT_LIMITS.maxAdds).toBe(20)
    expect(MEMBER_ADD_HEAT_LIMITS.windowMs).toBe(600_000)
    expect(MEMBER_ADD_HEAT_LIMITS.minIntervalMs).toBe(5_000)
  })
})
