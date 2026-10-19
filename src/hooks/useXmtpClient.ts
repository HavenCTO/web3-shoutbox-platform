import { createContext, useContext } from 'react'
import type { XmtpClient } from '@/lib/xmtp'

export type XmtpStatus = 'idle' | 'initializing' | 'ready' | 'error'

export interface XmtpContextValue {
  client: XmtpClient | null
  inboxId: string | null
  /** Auto-generated guest identity address (never shown raw in chat UI). */
  address: string | null
  /** Friendly alias derived from the address, e.g. "Amber Fox". */
  displayName: string | null
  status: XmtpStatus
  error: string | null
  retry: () => void
}

export const XmtpContext = createContext<XmtpContextValue | null>(null)

export function useXmtpClient(): XmtpContextValue {
  const ctx = useContext(XmtpContext)
  if (!ctx) {
    throw new Error('useXmtpClient must be used within an XmtpProvider')
  }
  return ctx
}
