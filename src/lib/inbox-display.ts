import type { OnlineUser } from '@/types/presence'

/** Shorten a long XMTP inbox id when we have no wallet address to show. */
export function truncateInboxId(inboxId: string): string {
  if (inboxId.length <= 14) return inboxId
  return `${inboxId.slice(0, 8)}…${inboxId.slice(-6)}`
}

/**
 * Maps inbox ids to Ethereum addresses using presence and the local wallet.
 * Used to label chat messages (XMTP only provides sender inbox id on decode).
 */
export function buildInboxAddressLookup(
  onlineUsers: readonly OnlineUser[],
  selfInboxId: string | null | undefined,
  selfAddress: string | null | undefined,
): Map<string, string> {
  const m = new Map<string, string>()
  for (const u of onlineUsers) {
    const a = u.address?.trim()
    if (a) m.set(u.inboxId, a)
  }
  const me = selfAddress?.trim()
  if (selfInboxId && me) m.set(selfInboxId, me)
  return m
}

/** Resolves a wallet address for UI, or a shortened inbox id if unknown. */
export function resolveSenderAddressForDisplay(
  senderInboxId: string,
  lookup: ReadonlyMap<string, string>,
): string {
  const addr = lookup.get(senderInboxId)?.trim()
  if (addr) return addr
  return truncateInboxId(senderInboxId)
}
