/**
 * Leader Election — deterministic, coordination-free.
 *
 * The leader is the online user with the lexicographically lowest Inbox ID.
 * All clients independently compute the same result from the same presence set.
 */

import type { OnlineUser } from '@/types/presence'

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
