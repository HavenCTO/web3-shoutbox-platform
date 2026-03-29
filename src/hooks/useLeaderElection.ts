import { useMemo } from 'react'
import { usePresenceStore } from '@/stores/presenceStore'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { electLeader, amILeader } from '@/lib/leader-election'

/**
 * Derives leader election state from the presence store and XMTP identity.
 * Pure computation — no side effects.
 */
export function useLeaderElection() {
  const onlineUsers = usePresenceStore((s) => s.onlineUsers)
  const { inboxId } = useXmtpClient()

  const leaderId = useMemo(() => electLeader(onlineUsers), [onlineUsers])

  const isLeader = useMemo(
    () => (inboxId ? amILeader(inboxId, onlineUsers) : false),
    [inboxId, onlineUsers],
  )

  const onlineUserCount = onlineUsers.filter((u) => u.isOnline).length

  return { isLeader, leaderId, onlineUserCount }
}
