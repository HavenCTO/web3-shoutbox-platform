/**
 * Leader Election — deterministic, coordination-free.
 *
 * The leader is the online user with the lexicographically lowest Inbox ID.
 * All clients independently compute the same result from the same presence set.
 */

import type { OnlineUser } from '@/types/presence'
import type { PresenceSyncStatus } from '@/types/presenceSync'

/** Returns the Inbox ID of the elected leader, or null if no users are online. */
export function electLeader(onlineUsers: OnlineUser[]): string | null {
  const online = onlineUsers.filter((u) => u.isOnline)
  if (online.length === 0) return null

  let lowest = online[0].inboxId
  for (let i = 1; i < online.length; i++) {
    if (online[i].inboxId < lowest) {
      lowest = online[i].inboxId
    }
  }
  return lowest
}

/** Returns true if the given Inbox ID is the elected leader. */
export function amILeader(myInboxId: string, onlineUsers: OnlineUser[]): boolean {
  return electLeader(onlineUsers) === myInboxId
}

/**
 * Only treat election as authoritative after Gun presence writes have acked successfully.
 * Otherwise every client can appear alone locally and wrongly become "host".
 */
export function electLeaderWhenPresenceSynced(
  syncStatus: PresenceSyncStatus,
  onlineUsers: OnlineUser[],
): string | null {
  if (syncStatus !== 'synced') return null
  return electLeader(onlineUsers)
}

/** Gated leader check for UI and group lifecycle. */
export function amILeaderWhenPresenceSynced(
  syncStatus: PresenceSyncStatus,
  myInboxId: string | null,
  onlineUsers: OnlineUser[],
): boolean {
  if (syncStatus !== 'synced' || !myInboxId) return false
  return amILeader(myInboxId, onlineUsers)
}
