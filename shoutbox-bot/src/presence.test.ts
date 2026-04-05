import { describe, it, expect, vi } from 'vitest'
import type { ShoutboxGunRef } from './gunTypes.js'
import { startGunPresenceHeartbeat } from './presence.js'

function createSelfReturningGun(): { ref: ShoutboxGunRef; puts: unknown[] } {
  const puts: unknown[] = []
  const ref: ShoutboxGunRef = {
    get() {
      return ref
    },
    put(value: unknown, cb?: (ack: { err?: unknown }) => void) {
      puts.push(value)
      queueMicrotask(() => {
        cb?.({})
      })
      return ref
    },
    on() {
      return ref
    },
    off() {
      return ref
    },
  }
  return { ref, puts }
}

describe('startGunPresenceHeartbeat', () => {
  it('writes an initial presence record and repeats on interval', () => {
    vi.useFakeTimers()
    const now = vi.fn()
    now.mockReturnValueOnce(1000).mockReturnValueOnce(2000).mockReturnValue(3000)
    const { ref, puts } = createSelfReturningGun()
    const stop = startGunPresenceHeartbeat({
      gun: ref,
      roomKey: 'rk',
      inboxId: 'in',
      address: '0xabc',
      intervalMs: 5000,
      now,
      setIntervalFn: globalThis.setInterval.bind(globalThis),
      clearIntervalFn: globalThis.clearInterval.bind(globalThis),
    })

    expect(puts).toHaveLength(1)
    expect(puts[0]).toEqual({
      inboxId: 'in',
      address: '0xabc',
      ts: 1000,
      status: 'online',
    })

    vi.advanceTimersByTime(5000)
    expect(puts.length).toBeGreaterThanOrEqual(2)

    stop()
    vi.useRealTimers()
  })

  it('logs when Gun reports a put error and log is set', async () => {
    const log = vi.fn()
    const ref: ShoutboxGunRef = {
      get() {
        return ref
      },
      put(_value, cb) {
        queueMicrotask(() => {
          cb?.({ err: 'relay-fail' })
        })
        return ref
      },
      on() {
        return ref
      },
      off() {
        return ref
      },
    }
    const stop = startGunPresenceHeartbeat({
      gun: ref,
      roomKey: 'rk',
      inboxId: 'in',
      address: '0xabc',
      intervalMs: 60_000,
      now: () => 1,
      setIntervalFn: () => 0 as unknown as ReturnType<typeof setInterval>,
      clearIntervalFn: vi.fn(),
      log,
    })
    await new Promise<void>((resolve) => {
      queueMicrotask(resolve)
    })
    expect(log).toHaveBeenCalledWith('[shoutbox-bot] Gun presence put error: relay-fail')
    stop()
  })

  it('formats Error instances from Gun put acks', async () => {
    const log = vi.fn()
    const ref: ShoutboxGunRef = {
      get() {
        return ref
      },
      put(_value, cb) {
        queueMicrotask(() => {
          cb?.({ err: new Error('disk-full') })
        })
        return ref
      },
      on() {
        return ref
      },
      off() {
        return ref
      },
    }
    const stop = startGunPresenceHeartbeat({
      gun: ref,
      roomKey: 'rk',
      inboxId: 'in',
      address: '0xabc',
      intervalMs: 60_000,
      now: () => 1,
      setIntervalFn: () => 0 as unknown as ReturnType<typeof setInterval>,
      clearIntervalFn: vi.fn(),
      log,
    })
    await new Promise<void>((resolve) => {
      queueMicrotask(resolve)
    })
    expect(log).toHaveBeenCalledWith('[shoutbox-bot] Gun presence put error: disk-full')
    stop()
  })

  it('formats non-object put errors with String()', async () => {
    const log = vi.fn()
    const ref: ShoutboxGunRef = {
      get() {
        return ref
      },
      put(_value, cb) {
        queueMicrotask(() => {
          cb?.({ err: 503 })
        })
        return ref
      },
      on() {
        return ref
      },
      off() {
        return ref
      },
    }
    const stop = startGunPresenceHeartbeat({
      gun: ref,
      roomKey: 'rk',
      inboxId: 'in',
      address: '0xabc',
      intervalMs: 60_000,
      now: () => 1,
      setIntervalFn: () => 0 as unknown as ReturnType<typeof setInterval>,
      clearIntervalFn: vi.fn(),
      log,
    })
    await new Promise<void>((resolve) => {
      queueMicrotask(resolve)
    })
    expect(log).toHaveBeenCalledWith('[shoutbox-bot] Gun presence put error: 503')
    stop()
  })

  it('serializes object-shaped Gun put errors', async () => {
    const log = vi.fn()
    const ref: ShoutboxGunRef = {
      get() {
        return ref
      },
      put(_value, cb) {
        queueMicrotask(() => {
          cb?.({ err: { code: 'EPERM', syscall: 'rename' } })
        })
        return ref
      },
      on() {
        return ref
      },
      off() {
        return ref
      },
    }
    const stop = startGunPresenceHeartbeat({
      gun: ref,
      roomKey: 'rk',
      inboxId: 'in',
      address: '0xabc',
      intervalMs: 60_000,
      now: () => 1,
      setIntervalFn: () => 0 as unknown as ReturnType<typeof setInterval>,
      clearIntervalFn: vi.fn(),
      log,
    })
    await new Promise<void>((resolve) => {
      queueMicrotask(resolve)
    })
    expect(log.mock.calls[0][0]).toContain('EPERM')
    expect(log.mock.calls[0][0]).toContain('rename')
    stop()
  })

  it('formats put errors when JSON.stringify fails', async () => {
    const log = vi.fn()
    const circular: Record<string, unknown> = {}
    circular.a = circular
    const ref: ShoutboxGunRef = {
      get() {
        return ref
      },
      put(_value, cb) {
        queueMicrotask(() => {
          cb?.({ err: circular })
        })
        return ref
      },
      on() {
        return ref
      },
      off() {
        return ref
      },
    }
    const stop = startGunPresenceHeartbeat({
      gun: ref,
      roomKey: 'rk',
      inboxId: 'in',
      address: '0xabc',
      intervalMs: 60_000,
      now: () => 1,
      setIntervalFn: () => 0 as unknown as ReturnType<typeof setInterval>,
      clearIntervalFn: vi.fn(),
      log,
    })
    await new Promise<void>((resolve) => {
      queueMicrotask(resolve)
    })
    expect(log.mock.calls[0][0]).toMatch(/Gun presence put error:/)
    stop()
  })
})
