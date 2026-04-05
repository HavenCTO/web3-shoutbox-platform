import { useEffect, useRef } from 'react'
import { useGun } from '@/hooks/useGun'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { useAuthStore } from '@/stores/authStore'
import { usePresenceStore } from '@/stores/presenceStore'
import { joinRoom, leaveRoom } from '@/services/presenceService'
import { resetPresenceSyncHealth } from '@/stores/gunPresenceSyncStore'

/**
 * Manages presence lifecycle for the current user in a room.
 * Automatically joins when XMTP is ready + roomKey is provided,
 * leaves on roomKey change or unmount, and registers beforeunload.
 */
export function usePresence(roomKey: string | null): void {
  const gun = useGun()
  const { inboxId, status } = useXmtpClient()
  const address = useAuthStore((s) => s.address)
  const { setPresent, clearPresence } = usePresenceStore()
  const cleanupRef = useRef<(() => void) | null>(null)
  const stateRef = useRef({ roomKey: null as string | null, inboxId: null as string | null })

  useEffect(() => {
    resetPresenceSyncHealth()
  }, [roomKey])

  useEffect(() => {
    // Leave previous room if state changed
    if (cleanupRef.current && (stateRef.current.roomKey !== roomKey || stateRef.current.inboxId !== inboxId)) {
      cleanupRef.current()
      cleanupRef.current = null
      clearPresence()
    }

    // Join new room if all prerequisites are met
    if (!roomKey || status !== 'ready' || !inboxId || !address) {
      stateRef.current = { roomKey, inboxId }
      return
    }

    const result = joinRoom(gun, roomKey, inboxId, address)
    if (result.ok) {
      cleanupRef.current = result.data
      setPresent(roomKey)
    }
    stateRef.current = { roomKey, inboxId }

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
        clearPresence()
      }
    }
  }, [roomKey, status, inboxId, address, gun, setPresent, clearPresence])

  // Best-effort cleanup on tab close
  useEffect(() => {
    const onBeforeUnload = () => {
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])
}
