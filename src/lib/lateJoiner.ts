import type { OnlineUser } from '@/types/presence'

/**
 * Addresses the leader still needs to add to the live group: online,
 * deduplicated (case-insensitive), minus already-attempted and excluded
 * (e.g. standing bridges, which are seated at creation).
 */
export function newMemberAddresses(
  onlineUsers: readonly OnlineUser[],
  attempted: ReadonlySet<string>,
  exclude: readonly string[] = [],
): string[] {
  const excluded = new Set(exclude.map((a) => a.trim().toLowerCase()))
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of onlineUsers) {
    if (!u.isOnline) continue
    const addr = u.address.trim().toLowerCase()
    if (!addr || seen.has(addr) || attempted.has(addr) || excluded.has(addr)) continue
    seen.add(addr)
    out.push(addr)
  }
  return out
}
