/**
 * PostMessage protocol for iframe ↔ parent communication.
 *
 * Privacy by design: NEVER sends message content — only metadata
 * (counts, IDs, connection status). Messages are E2E encrypted via XMTP.
 */

import type { ShoutboxPostMessage, ShoutboxCommandType } from '@/types/embed'

export interface EmbedConfig {
  room?: string
  theme?: 'light' | 'dark'
  compact?: boolean
  showPresence?: boolean
  maxHeight?: number
}

const isDev = import.meta.env.DEV

/**
 * Validates if a message origin is allowed.
 * In development, all origins are allowed. In production, validate against known hosts.
 */
function isAllowedOrigin(origin: string): boolean {
  if (isDev) return true
  // In production, add known embed host origins here
  const allowed = import.meta.env.VITE_ALLOWED_PARENT_ORIGINS?.split(',') ?? ['*']
  return allowed.includes('*') || allowed.includes(origin)
}

/** Send a typed event from the iframe to the parent window. */
export function sendToParent(message: ShoutboxPostMessage): void {
  if (typeof window === 'undefined' || window.parent === window) return
  const parentOrigin = document.referrer ? new URL(document.referrer).origin : '*'
  const targetOrigin = isAllowedOrigin(parentOrigin) ? parentOrigin : '*'
  window.parent.postMessage(message, targetOrigin)
}

/** Listen for commands from the parent window. Returns an unsubscribe function. */
export function onParentMessage(
  handler: (message: { type: ShoutboxCommandType; payload?: unknown }) => void,
): () => void {
  const listener = (event: MessageEvent) => {
    if (!isAllowedOrigin(event.origin)) return
    if (event.data?.source !== 'web3-shoutbox-parent') return
    handler(event.data)
  }
  window.addEventListener('message', listener)
  return () => window.removeEventListener('message', listener)
}

/** Uses ResizeObserver to emit `resize` events to the parent so the iframe height can be adjusted. */
export function enableAutoResize(rootElement: HTMLElement): () => void {
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      sendToParent({
        source: 'web3-shoutbox',
        type: 'resize',
        payload: { height: Math.ceil(entry.contentRect.height) },
      })
    }
  })
  observer.observe(rootElement)
  return () => observer.disconnect()
}

/** Parse URL search parameters into a typed embed config. */
export function parseEmbedConfig(searchParams: URLSearchParams): EmbedConfig {
  const maxHeightRaw = searchParams.get('maxHeight')
  return {
    room: searchParams.get('room') || undefined,
    theme: (searchParams.get('theme') as 'light' | 'dark') || undefined,
    compact: searchParams.get('compact') === 'true' || undefined,
    showPresence: searchParams.has('showPresence')
      ? searchParams.get('showPresence') !== 'false'
      : undefined,
    maxHeight: maxHeightRaw ? Number(maxHeightRaw) : undefined,
  }
}
