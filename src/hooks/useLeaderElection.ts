import { useMemo } from 'react'
import { usePresenceStore } from '@/stores/presenceStore'
import { useGunPresenceSyncStore } from '@/stores/gunPresenceSyncStore'
import { useChatStore } from '@/stores/chatStore'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { electStickyLeaderWhenPresenceSynced, amIStickyLeaderWhenPresenceSynced } from '@/lib/leader-election'

/**
 * Derives leader election state from the presence store and XMTP identity.
 * Pure computation — no side effects.
 */
export function useLeaderElection() {
  const onlineUsers = usePresenceStore((s) => s.onlineUsers)
  const syncStatus = useGunPresenceSyncStore((s) => s.syncStatus)
  const activeGroupCreator = useChatStore((s) => s.activeGroupCreator)
  const { inboxId } = useXmtpClient()

  // Sticky: the active group's creator stays host while online.
  const leaderId = useMemo(
    () => electStickyLeaderWhenPresenceSynced(syncStatus, onlineUsers, activeGroupCreator),
    [syncStatus, onlineUsers, activeGroupCreator],
  )

  const isLeader = useMemo(
    () => amIStickyLeaderWhenPresenceSynced(syncStatus, inboxId ?? null, onlineUsers, activeGroupCreator),
    [syncStatus, inboxId, onlineUsers, activeGroupCreator],
  )

  const onlineUserCount = onlineUsers.filter((u) => u.isOnline).length

  return { isLeader, leaderId, onlineUserCount }
}
