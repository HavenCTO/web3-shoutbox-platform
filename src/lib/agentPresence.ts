import type { OnlineUser } from '@/types/presence'

/**
 * Display list with standing agent bridges included. The bridge is seated
 * in the group at creation, so once a group is live it is shown
 * immediately — it does not wait for the bridge's first relayed message.
 * Bridges already present (by address, case-insensitive) are not duplicated.
 */
export function withAgentPresence(
  onlineUsers: readonly OnlineUser[],
  agentAddresses: readonly string[],
): OnlineUser[] {
  const present = new Set(onlineUsers.map((u) => u.address.trim().toLowerCase()))
  const extras: OnlineUser[] = []
  for (const addr of agentAddresses) {
    const a = addr.trim()
    if (!a || present.has(a.toLowerCase())) continue
    extras.push({ inboxId: `bridge:${a.toLowerCase()}`, address: a, lastSeen: Date.now(), isOnline: true })
  }
  return extras.length === 0 ? [...onlineUsers] : [...onlineUsers, ...extras]
}
