import { useEffect, useRef } from 'react'
import { useGun } from '@/hooks/useGun'
import { usePresenceStore } from '@/stores/presenceStore'
import { subscribeToPresence, type GunPresenceData } from '@/lib/gun-presence'
import { createRafBatchScheduler } from '@/lib/rafBatchScheduler'
import { getOnlineUsers } from '@/services/presenceService'

const CLEANUP_INTERVAL_MS = 10_000

/**
 * Subscribes to presence for a room, maintains online user list,
 * and periodically prunes stale users.
 */
export function useOnlineUsers(roomKey: string | null): void {
  const gun = useGun()
  const setOnlineUsers = usePresenceStore((s) => s.setOnlineUsers)
  const recordsRef = useRef(new Map<string, GunPresenceData>())

  useEffect(() => {
    if (!roomKey) {
      setOnlineUsers([])
      return
    }

    const records = recordsRef.current
    records.clear()

    const pushUpdate = (): void => {
      const all = getOnlineUsers(records)
      setOnlineUsers(all)
    }

    const batcher = createRafBatchScheduler(pushUpdate)

    const unsub = subscribeToPresence(gun, roomKey, (data, key) => {
      if (data) {
        records.set(key, data)
      }
      batcher.schedule()
    })

    // Periodic cleanup — removes stale users who haven't sent a heartbeat
    const cleanupTimer = setInterval(() => batcher.schedule(), CLEANUP_INTERVAL_MS)

    return () => {
      batcher.cancel()
      unsub()
      clearInterval(cleanupTimer)
      records.clear()
      setOnlineUsers([])
    }
  }, [roomKey, gun, setOnlineUsers])
}
