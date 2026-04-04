import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { XmtpClient } from '@/lib/xmtp'
import {
  fetchInboxEthereumAddressMap,
  isDisplayAddressVerifiedByXmtp,
} from '@/services/xmtpIdentityVerification'

const CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry {
  addresses: ReadonlySet<string>
  expiresAt: number
}

function uniqueSortedInboxIds(senderInboxIds: readonly string[]): string[] {
  const u = [...new Set(senderInboxIds.filter((id) => id.length > 0))]
  u.sort()
  return u
}

/**
 * Fetches XMTP inbox ↔ Ethereum identifier bindings for message senders.
 * Used to show a verified badge when the displayed address matches XMTP identity (not Gun).
 */
export function useXmtpSenderVerification(
  client: XmtpClient | null,
  senderInboxIds: readonly string[],
): {
  isAddressVerifiedForSender: (senderInboxId: string, displayedAddress: string) => boolean
} {
  const [addressMap, setAddressMap] = useState<Map<string, ReadonlySet<string>>>(new Map())
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map())

  const idsFingerprint = useMemo(
    () => uniqueSortedInboxIds(senderInboxIds).join('\0'),
    [senderInboxIds],
  )

  useEffect(() => {
    const ids = uniqueSortedInboxIds(senderInboxIds)
    if (!client || ids.length === 0) {
      setAddressMap(new Map())
      return
    }

    let cancelled = false
    const run = async () => {
      const now = Date.now()
      const toFetch: string[] = []
      const nextMap = new Map<string, ReadonlySet<string>>()

      for (const id of ids) {
        const cached = cacheRef.current.get(id)
        if (cached && cached.expiresAt > now) {
          nextMap.set(id, cached.addresses)
        } else {
          toFetch.push(id)
        }
      }

      if (toFetch.length > 0) {
        try {
          const fresh = await fetchInboxEthereumAddressMap(client, toFetch)
          for (const [inboxId, set] of fresh) {
            cacheRef.current.set(inboxId, {
              addresses: set,
              expiresAt: now + CACHE_TTL_MS,
            })
          }
        } catch (e) {
          console.warn('[shoutbox] XMTP fetchInboxStates failed:', e)
        }
      }

      for (const id of ids) {
        const cached = cacheRef.current.get(id)
        if (cached) nextMap.set(id, cached.addresses)
      }

      if (!cancelled) setAddressMap(nextMap)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [client, idsFingerprint])

  const isAddressVerifiedForSender = useCallback(
    (senderInboxId: string, displayedAddress: string) =>
      isDisplayAddressVerifiedByXmtp(senderInboxId, displayedAddress, addressMap),
    [addressMap],
  )

  return { isAddressVerifiedForSender }
}
