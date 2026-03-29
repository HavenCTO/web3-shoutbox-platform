import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { useAccount } from 'wagmi'
import {
  parseEmbedConfig,
  sendToParent,
  onParentMessage,
  enableAutoResize,
  type EmbedConfig,
} from '@/lib/embed-messaging'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { usePresenceStore } from '@/stores/presenceStore'
import type { ShoutboxPostMessage, ShoutboxEventType } from '@/types/embed'

export function useEmbed() {
  const [searchParams] = useSearchParams()
  const [config, setConfig] = useState<EmbedConfig>(() => parseEmbedConfig(searchParams))

  const isEmbed =
    typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/embed/') || window.self !== window.top)

  const { isConnected, address } = useAccount()
  const { inboxId, status: xmtpStatus } = useXmtpClient()
  const onlineUsers = usePresenceStore((s) => s.onlineUsers)

  // Track previous values for change detection
  const prevConnected = useRef(isConnected)
  const prevOnlineCount = useRef(onlineUsers.length)

  const emitEvent = useCallback(
    (type: ShoutboxEventType, payload?: unknown) => {
      if (!isEmbed) return
      const msg: ShoutboxPostMessage = { source: 'web3-shoutbox', type, payload }
      sendToParent(msg)
    },
    [isEmbed],
  )

  // Command handler — returns a setter for room so the page can react
  const [commandRoom, setCommandRoom] = useState<string | undefined>()
  const [commandTheme, setCommandTheme] = useState<'light' | 'dark' | undefined>()

  // Listen for parent commands + auto-resize + emit ready
  useEffect(() => {
    if (!isEmbed) return

    const unsubCommands = onParentMessage((msg) => {
      switch (msg.type) {
        case 'set-room': {
          const room = (msg.payload as { room?: string })?.room
          if (room) setCommandRoom(room)
          break
        }
        case 'set-theme': {
          const theme = (msg.payload as { theme?: 'light' | 'dark' })?.theme
          if (theme) {
            setCommandTheme(theme)
            setConfig((prev) => ({ ...prev, theme }))
          }
          break
        }
        case 'get-status':
          sendToParent({
            source: 'web3-shoutbox',
            type: 'status-response',
            payload: {
              isConnected,
              address: address ?? null,
              onlineCount: onlineUsers.length,
              xmtpStatus,
            },
          })
          break
      }
    })

    sendToParent({ source: 'web3-shoutbox', type: 'ready', payload: { room: config.room ?? null } })

    return unsubCommands
  }, [isEmbed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Emit wallet-connected / wallet-disconnected on change
  useEffect(() => {
    if (!isEmbed) return
    if (isConnected && !prevConnected.current) {
      emitEvent('wallet-connected', { address, inboxId })
    } else if (!isConnected && prevConnected.current) {
      emitEvent('wallet-disconnected')
    }
    prevConnected.current = isConnected
  }, [isConnected, address, inboxId, isEmbed, emitEvent])

  // Emit presence-updated when online count changes
  useEffect(() => {
    if (!isEmbed) return
    const count = onlineUsers.length
    if (count !== prevOnlineCount.current) {
      emitEvent('presence-updated', { onlineCount: count })
      prevOnlineCount.current = count
    }
  }, [onlineUsers.length, isEmbed, emitEvent])

  return {
    isEmbed,
    embedConfig: config,
    emitEvent,
    enableAutoResize,
    commandRoom,
    commandTheme,
  }
}
