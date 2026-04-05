import { describe, it, expect, vi } from 'vitest'
import type { ShoutboxGunRef } from './gunTypes.js'
import { subscribeToGroupWindow } from './groupSubscription.js'

function createGunWithOnHandler(): {
  gun: ShoutboxGunRef
  trigger: (data: unknown) => void
  offSpy: ReturnType<typeof vi.fn>
} {
  let handler: ((data: unknown) => void) | null = null
  const offSpy = vi.fn()
  const ref: ShoutboxGunRef = {
    get() {
      return ref
    },
    put() {
      return ref
    },
    on(cb: (data: unknown) => void) {
      handler = cb
      return ref
    },
    off() {
      offSpy()
      handler = null
      return ref
    },
  }
  return {
    gun: ref,
    trigger: (data: unknown) => {
      handler?.(data)
    },
    offSpy,
  }
}

describe('subscribeToGroupWindow', () => {
  it('notifies when an active window arrives', () => {
    const { gun, trigger } = createGunWithOnHandler()
    const cb = vi.fn()
    subscribeToGroupWindow(gun, 'rk', cb, { now: () => 100 })
    trigger({
      groupId: 'g1',
      epoch: 1,
      createdBy: 'c',
      createdAt: 0,
      expiresAt: 500,
      windowMinutes: 5,
    })
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'g1', epoch: 1 }),
    )
  })

  it('notifies null when expired or invalid', () => {
    const { gun, trigger } = createGunWithOnHandler()
    const cb = vi.fn()
    subscribeToGroupWindow(gun, 'rk', cb, { now: () => 9999 })
    trigger({
      groupId: 'g1',
      epoch: 1,
      createdBy: 'c',
      createdAt: 0,
      expiresAt: 100,
      windowMinutes: 5,
    })
    expect(cb).toHaveBeenCalledWith(null)
    cb.mockClear()
    trigger({})
    expect(cb).toHaveBeenCalledWith(null)
  })

  it('unsubscribes with off', () => {
    const { gun, offSpy } = createGunWithOnHandler()
    const unsub = subscribeToGroupWindow(gun, 'rk', vi.fn(), { now: () => 1 })
    unsub()
    expect(offSpy).toHaveBeenCalled()
  })
})
