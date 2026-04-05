import { useMemo } from 'react'
import { usePresenceStore } from '@/stores/presenceStore'
import { useGunPresenceSyncStore } from '@/stores/gunPresenceSyncStore'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { electLeaderWhenPresenceSynced, amILeaderWhenPresenceSynced } from '@/lib/leader-election'

/**
 * Derives leader election state from the presence store and XMTP identity.
 * Pure computation — no side effects.
 */
export function useLeaderElection() {
  const onlineUsers = usePresenceStore((s) => s.onlineUsers)
  const syncStatus = useGunPresenceSyncStore((s) => s.syncStatus)
  const { inboxId } = useXmtpClient()

  const leaderId = useMemo(
    () => electLeaderWhenPresenceSynced(syncStatus, onlineUsers),
    [syncStatus, onlineUsers],
  )

  const isLeader = useMemo(
    () => amILeaderWhenPresenceSynced(syncStatus, inboxId ?? null, onlineUsers),
    [syncStatus, inboxId, onlineUsers],
  )

  const onlineUserCount = onlineUsers.filter((u) => u.isOnline).length

  return { isLeader, leaderId, onlineUserCount }
}
