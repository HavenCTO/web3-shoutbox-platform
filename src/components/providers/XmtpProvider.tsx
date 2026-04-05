import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { IdentifierKind } from '@xmtp/browser-sdk'
import type { Signer } from '@xmtp/browser-sdk'
import { toBytes, type WalletClient } from 'viem'
import { toast } from 'sonner'
import { initializeXmtpClient, getInboxId } from '@/services/messagingService'
import type { XmtpClient } from '@/lib/xmtp'
import { XmtpContext, type XmtpStatus } from '@/hooks/useXmtpClient'
import {
  isUserRejection,
  isBrowserCompatError,
  isInstallationLimitError,
} from '@/types/errors'

function walletClientToSigner(wc: WalletClient): Signer {
  const account = wc.account!
  return {
    type: 'EOA' as const,
    getIdentifier: () => ({
      identifier: account.address.toLowerCase(),
      identifierKind: IdentifierKind.Ethereum,
    }),
    signMessage: async (message: string) => {
      const sig = await wc.signMessage({ account, message })
      return toBytes(sig)
    },
  }
}

function friendlyErrorMessage(error: unknown): string {
  if (isUserRejection(error)) return 'Signature request was rejected. Please try again.'
  if (isBrowserCompatError(error))
    return 'Your browser may not support the required storage features. Try a different browser or disable strict privacy mode.'
  if (isInstallationLimitError(error))
    return 'XMTP allows at most 10 devices or browsers per wallet. Revoke old installations (e.g. from another browser where this wallet still works), then try again. See https://docs.xmtp.org/chat-apps/core-messaging/manage-inboxes'
  return error instanceof Error ? error.message : 'Failed to initialize messaging'
}

export function XmtpProvider({ children }: { children: ReactNode }) {
  const { isConnected, address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [client, setClient] = useState<XmtpClient | null>(null)
  const [inboxId, setInboxId] = useState<string | null>(null)
  const [status, setStatus] = useState<XmtpStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)

  const initialize = useCallback(async () => {
    if (!walletClient) return
    if (initRef.current) return
    initRef.current = true

    setStatus('initializing')
    setError(null)

    const signer = walletClientToSigner(walletClient)
    const result = await initializeXmtpClient(signer)

    if (result.ok) {
      const id = getInboxId(result.data) ?? null
      setClient(result.data)
      setInboxId(id)
      setStatus('ready')
    } else {
      const msg = friendlyErrorMessage(result.error)
      setError(msg)
      setStatus('error')
      console.error('[XmtpProvider] initialization failed:', result.error)
    }
    initRef.current = false
  }, [walletClient])

  // Auto-initialize when wallet connects (or after retry resets to idle)
  useEffect(() => {
    if (isConnected && walletClient && status === 'idle') {
      initialize()
    }
  }, [isConnected, walletClient, status, initialize])

  // Cleanup on wallet disconnect — cancel pending operations
  useEffect(() => {
    if (!isConnected && client) {
      setClient(null)
      setInboxId(null)
      setStatus('idle')
      setError(null)
      toast.info('Wallet disconnected')
    }
  }, [isConnected, client])

  const retry = useCallback(() => {
    setStatus('idle')
    setError(null)
    setClient(null)
    setInboxId(null)
  }, [])

  return (
    <XmtpContext.Provider value={{ client, inboxId, status, error, retry }}>
      {children}
    </XmtpContext.Provider>
  )
}
