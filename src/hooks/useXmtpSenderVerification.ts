import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { XmtpClient } from '@/lib/xmtp'
import type { ShoutboxMessage } from '@/types/message'
import { resolveSenderAddressForDisplay } from '@/lib/inbox-display'
import {
  isLikelyEthereumAddress,
  normalizeEthereumAddress,
  verificationPairKey,
  verifyEthereumAddressForInbox,
} from '@/services/xmtpIdentityVerification'

function uniqueVerificationPairs(
  messages: readonly ShoutboxMessage[],
  inboxToAddress: ReadonlyMap<string, string>,
): { senderInboxId: string; displayAddress: string }[] {
  const seen = new Set<string>()
  const out: { senderInboxId: string; displayAddress: string }[] = []
  for (const m of messages) {
    const displayAddress = resolveSenderAddressForDisplay(m.senderInboxId, inboxToAddress)
    if (!isLikelyEthereumAddress(displayAddress)) continue
    const key = verificationPairKey(m.senderInboxId, normalizeEthereumAddress(displayAddress))
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ senderInboxId: m.senderInboxId, displayAddress })
  }
  return out
}

/**
 * Resolves whether each (sender inbox, displayed 0x address) pair matches XMTP’s address→inbox mapping.
 */
export function useXmtpSenderVerification(
  client: XmtpClient | null,
  messages: readonly ShoutboxMessage[],
  inboxToAddress: ReadonlyMap<string, string>,
): {
  isAddressVerifiedForSender: (senderInboxId: string, displayedAddress: string) => boolean
} {
  const [verified, setVerified] = useState<Map<string, boolean>>(new Map())
  const resultCacheRef = useRef<Map<string, boolean>>(new Map())

  const pairs = useMemo(
    () => uniqueVerificationPairs(messages, inboxToAddress),
    [messages, inboxToAddress],
  )

  const pairsKey = useMemo(
    () =>
      pairs
        .map((p) => `${p.senderInboxId}:${normalizeEthereumAddress(p.displayAddress)}`)
        .sort()
        .join('|'),
    [pairs],
  )

  useEffect(() => {
    if (!client || pairs.length === 0) {
      setVerified(new Map())
      return
    }

    let cancelled = false
    const run = async () => {
      const next = new Map<string, boolean>()

      for (const { senderInboxId, displayAddress } of pairs) {
        const key = verificationPairKey(senderInboxId, normalizeEthereumAddress(displayAddress))
        const cached = resultCacheRef.current.get(key)
        if (cached !== undefined) {
          next.set(key, cached)
          continue
        }
        const match = await verifyEthereumAddressForInbox(senderInboxId, displayAddress)
        resultCacheRef.current.set(key, match)
        next.set(key, match)
      }

      if (!cancelled) setVerified(next)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [client, pairsKey])

  const isAddressVerifiedForSender = useCallback(
    (senderInboxId: string, displayedAddress: string) => {
      if (!isLikelyEthereumAddress(displayedAddress)) return false
      const key = verificationPairKey(senderInboxId, normalizeEthereumAddress(displayedAddress))
      return verified.get(key) === true
    },
    [verified],
  )

  return { isAddressVerifiedForSender }
}
