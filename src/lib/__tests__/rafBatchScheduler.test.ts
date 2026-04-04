import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRafBatchScheduler } from '@/lib/rafBatchScheduler'

describe('createRafBatchScheduler', () => {
  let queued: FrameRequestCallback | null = null

  beforeEach(() => {
    queued = null
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      queued = cb
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', (_handle: number): void => {
      queued = null
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function flushFrame(): void {
    const cb = queued
    queued = null
    cb?.(0)
  }

  it('runs the callback when the frame is flushed', () => {
    let runs = 0
    const scheduler = createRafBatchScheduler(() => {
      runs++
    })

    scheduler.schedule()
    flushFrame()
    expect(runs).toBe(1)
  })

  it('coalesces multiple schedule() calls into one run per frame', () => {
    let runs = 0
    const scheduler = createRafBatchScheduler(() => {
      runs++
    })

    scheduler.schedule()
    scheduler.schedule()
    scheduler.schedule()
    flushFrame()
    expect(runs).toBe(1)
  })

  it('allows another run after the frame completes', () => {
    let runs = 0
    const scheduler = createRafBatchScheduler(() => {
      runs++
    })

    scheduler.schedule()
    flushFrame()
    scheduler.schedule()
    flushFrame()
    expect(runs).toBe(2)
  })

  it('cancel prevents the scheduled run before the frame fires', () => {
    let runs = 0
    const scheduler = createRafBatchScheduler(() => {
      runs++
    })

    scheduler.schedule()
    scheduler.cancel()
    flushFrame()
    expect(runs).toBe(0)
  })
})
