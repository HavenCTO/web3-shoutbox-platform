import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { initializeXmtpClient, getInboxId } from '@/services/messagingService'
import type { XmtpClient } from '@/lib/xmtp'
import { getOrCreateEphemeralIdentity, createEphemeralSigner } from '@/lib/ephemeral-identity'
import { deriveDisplayName } from '@/lib/display-name'
import { useAuthStore } from '@/stores/authStore'
import { XmtpContext, type XmtpStatus } from '@/hooks/useXmtpClient'
import { isBrowserCompatError, isInstallationLimitError } from '@/types/errors'

function friendlyErrorMessage(error: unknown): string {
  if (isBrowserCompatError(error))
    return 'Your browser may not support the required storage features. Try a different browser or disable strict privacy mode.'
  if (isInstallationLimitError(error))
    return 'Too many active sessions (limit: 10). Please close other tabs or devices and try again.'
  return error instanceof Error ? error.message : 'Failed to initialize messaging'
}

export function XmtpProvider({ children }: { children: ReactNode }) {
  // Guest identity is created synchronously on first load — no wallet, no prompts.
  const identity = useMemo(() => getOrCreateEphemeralIdentity(), [])
  const [client, setClient] = useState<XmtpClient | null>(null)
  const [inboxId, setInboxId] = useState<string | null>(null)
  const [status, setStatus] = useState<XmtpStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)
  const setConnected = useAuthStore((s) => s.setConnected)

  const displayName = useMemo(() => deriveDisplayName(identity.address), [identity.address])

  const initialize = useCallback(async () => {
    if (initRef.current) return
    initRef.current = true
    setStatus('initializing')
    setError(null)

    const result = await initializeXmtpClient(createEphemeralSigner(identity))

    if (result.ok) {
      setClient(result.data)
      setInboxId(getInboxId(result.data) ?? null)
      setStatus('ready')
      setConnected(identity.address)
    } else {
      const msg = friendlyErrorMessage(result.error)
      setError(msg)
      setStatus('error')
      console.error('[XmtpProvider] initialization failed:', result.error)
    }
    initRef.current = false
  }, [identity, setConnected])

  // Auto-initialize in the background as soon as the app loads.
  useEffect(() => {
    if (status !== 'idle') return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void initialize()
    })
    return () => {
      cancelled = true
    }
  }, [status, initialize])

  const retry = useCallback(() => {
    setStatus('idle')
    setError(null)
    setClient(null)
    setInboxId(null)
  }, [])

  return (
    <XmtpContext.Provider
      value={{ client, inboxId, address: identity.address, displayName, status, error, retry }}
    >
      {children}
    </XmtpContext.Provider>
  )
}
