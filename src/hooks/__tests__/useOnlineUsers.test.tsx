import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { GunInstance } from 'gun'
import { GunContext } from '@/hooks/useGun'
import { useOnlineUsers } from '@/hooks/useOnlineUsers'
import { usePresenceStore } from '@/stores/presenceStore'
import type { GunPresenceData } from '@/lib/gun-presence'
import { subscribeToPresence } from '@/lib/gun-presence'

vi.mock('@/lib/gun-presence', () => ({
  writePresence: vi.fn(),
  clearPresence: vi.fn(),
  subscribeToPresence: vi.fn(() => vi.fn()),
}))

function PresenceHost({ roomKey }: { roomKey: string | null }): null {
  useOnlineUsers(roomKey)
  return null
}

function mountPresence(roomKey: string | null, gun: GunInstance): { unmount: () => void } {
  const container = document.createElement('div')
  const root = createRoot(container)
  act(() => {
    root.render(
      createElement(GunContext.Provider, { value: gun }, createElement(PresenceHost, { roomKey })),
    )
  })
  return {
    unmount(): void {
      act(() => {
        root.unmount()
      })
    },
  }
}

describe('useOnlineUsers', () => {
  let queued: FrameRequestCallback | null = null

  beforeEach(() => {
    usePresenceStore.setState({ onlineUsers: [] })
    queued = null
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      queued = cb
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', (_handle: number): void => {
      queued = null
    })
    vi.mocked(subscribeToPresence).mockReset()
    vi.mocked(subscribeToPresence).mockReturnValue(vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function flushFrame(): void {
    const cb = queued
    queued = null
    void cb?.(0)
  }

  it('batches multiple Gun presence callbacks into one setOnlineUsers per animation frame', () => {
    const setSpy = vi.spyOn(usePresenceStore.getState(), 'setOnlineUsers')
    let onPresence: ((data: GunPresenceData | null, key: string) => void) | undefined

    vi.mocked(subscribeToPresence).mockImplementation((_gun, _roomKey, cb) => {
      onPresence = cb
      return vi.fn()
    })

    const gun = {} as GunInstance
    const { unmount } = mountPresence('room-a', gun)

    const now = Date.now()
    const payloadA: GunPresenceData = {
      inboxId: 'a',
      address: '0x1',
      ts: now,
      status: 'online',
    }
    const payloadB: GunPresenceData = {
      inboxId: 'b',
      address: '0x2',
      ts: now,
      status: 'online',
    }

    act(() => {
      onPresence!(payloadA, 'key-a')
      onPresence!(payloadB, 'key-b')
    })

    expect(setSpy).not.toHaveBeenCalled()

    act(() => {
      flushFrame()
    })

    expect(setSpy).toHaveBeenCalledTimes(1)
    const firstCall = setSpy.mock.calls[0]
    expect(firstCall).toBeDefined()
    expect(firstCall![0]).toHaveLength(2)

    unmount()
  })

  it('does not subscribe when roomKey is null', () => {
    const gun = {} as GunInstance
    const { unmount } = mountPresence(null, gun)

    expect(subscribeToPresence).not.toHaveBeenCalled()
    expect(usePresenceStore.getState().onlineUsers).toEqual([])

    unmount()
  })
})
