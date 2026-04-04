/**
 * XMTP sender verification: compare displayed 0x address to sender inbox using
 * getInboxIdForIdentifier (network mapping). fetchInboxStates often omits identities[]
 * for peers, so inbox-state parsing alone is unreliable.
 */

import { createBackend, getInboxIdForIdentifier, IdentifierKind } from '@xmtp/browser-sdk'
import type { Backend } from '@xmtp/browser-sdk'
import { env } from '@/config/env'

export function isLikelyEthereumAddress(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim())
}

export function normalizeEthereumAddress(s: string): string {
  return s.trim().toLowerCase()
}

/** Stable cache key for (inbox id, address) verification. */
export function verificationPairKey(senderInboxId: string, normalizedAddress: string): string {
  return `${senderInboxId}\0${normalizedAddress}`
}

let sharedBackend: Promise<Backend> | null = null

function getSharedBackend(): Promise<Backend> {
  if (!sharedBackend) sharedBackend = createBackend({ env: env.VITE_XMTP_ENV })
  return sharedBackend
}

/**
 * Returns true iff XMTP resolves this Ethereum address to the given inbox id.
 */
export async function verifyEthereumAddressForInbox(
  senderInboxId: string,
  address: string,
): Promise<boolean> {
  if (!isLikelyEthereumAddress(address)) return false
  const normalized = normalizeEthereumAddress(address)
  try {
    const backend = await getSharedBackend()
    const resolved = await getInboxIdForIdentifier(backend, {
      identifier: normalized,
      identifierKind: IdentifierKind.Ethereum,
    })
    return resolved === senderInboxId
  } catch (e) {
    console.warn('[shoutbox:xmtp-verify] getInboxIdForIdentifier failed', e)
    return false
  }
}
