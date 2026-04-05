import { useEffect, useRef, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { Loader2 } from 'lucide-react'
import { useEmbed } from '@/hooks/useEmbed'
import { useGunPresenceSyncStore } from '@/stores/gunPresenceSyncStore'
import { useShoutboxRoom } from '@/hooks/useShoutboxRoom'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { ChatContainer } from '@/components/chat/ChatContainer'
import { Skeleton } from '@/components/ui/Skeleton'

const DEFAULT_ROOM = 'https://shoutbox.example.com/default'

function resolveRoom(configRoom?: string, commandRoom?: string): string {
  if (commandRoom) return commandRoom
  if (configRoom) return configRoom
  if (typeof document !== 'undefined' && document.referrer) {
    try {
      const url = new URL(document.referrer)
      return `${url.origin}${url.pathname}`.replace(/\/$/, '')
    } catch { /* fall through */ }
  }
  return DEFAULT_ROOM
}

export function EmbedShoutboxPage() {
  const rootRef = useRef<HTMLDivElement>(null)
  const { embedConfig, emitEvent, enableAutoResize, commandRoom, commandTheme } = useEmbed()
  const { isConnected } = useAccount()
  const { status: xmtpStatus } = useXmtpClient()
  const { open } = useAppKit()

  const roomUrl = useMemo(
    () => resolveRoom(embedConfig.room, commandRoom),
    [embedConfig.room, commandRoom],
  )

  const room = useShoutboxRoom(roomUrl)
  const presenceDegraded = useGunPresenceSyncStore((s) => s.syncStatus === 'degraded')

  useEffect(() => {
    if (rootRef.current) return enableAutoResize(rootRef.current)
  }, [enableAutoResize])

  const prevMsgCount = useRef(room.messages.length)
  useEffect(() => {
    const count = room.messages.length
    if (count > prevMsgCount.current) {
      emitEvent('message-received', { count })
    }
    prevMsgCount.current = count
  }, [room.messages.length, emitEvent])

  const theme = commandTheme ?? embedConfig.theme ?? 'light'
  const showPresence = embedConfig.showPresence ?? true
  const maxHeight = embedConfig.maxHeight
  const isDark = theme === 'dark'

  const bg = isDark ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'

  // Not connected
  if (!isConnected) {
    return (
      <div
        ref={rootRef}
        className={`animate-fade-in flex h-screen w-screen flex-col items-center justify-center gap-3 p-3 ${bg}`}
        style={{ maxHeight: maxHeight ? `${maxHeight}px` : undefined, minWidth: 280 }}
      >
        <p className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Connect your wallet to join the chat
        </p>
        <button
          onClick={() => open()}
          className="focus-ring rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors sm:px-4 sm:py-2 sm:text-sm"
        >
          Connect Wallet
        </button>
      </div>
    )
  }

  // XMTP initializing
  if (xmtpStatus === 'initializing') {
    return (
      <div
        ref={rootRef}
        className={`animate-fade-in flex h-screen w-screen flex-col items-center justify-center gap-3 p-3 ${bg}`}
        style={{ maxHeight: maxHeight ? `${maxHeight}px` : undefined, minWidth: 280 }}
      >
        <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
        <p className={`text-xs sm:text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          Initializing encrypted messaging…
        </p>
        <div className="w-full max-w-xs space-y-2">
          <Skeleton className="h-2 w-3/4 mx-auto" />
          <Skeleton className="h-2 w-1/2 mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className={`flex h-screen w-screen flex-col overflow-hidden ${bg}`}
      style={{ maxHeight: maxHeight ? `${maxHeight}px` : undefined, minWidth: 280 }}
    >
      {/* Compact presence bar */}
      {showPresence && room.onlineUsers.length > 0 && (
        <div
          className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b px-2 py-0.5 text-[10px] sm:px-3 sm:py-1 sm:text-xs ${isDark ? 'border-gray-700 bg-gray-800 text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-500'}`}
        >
          <span className="inline-flex items-center gap-1">
            <span
              className={`h-1.5 w-1.5 rounded-full ${presenceDegraded ? 'bg-amber-500' : 'bg-green-500'}`}
            />
            {room.onlineUsers.length} online
          </span>
          {presenceDegraded && (
            <span className={isDark ? 'text-amber-400' : 'text-amber-700'}>Presence relay unreachable</span>
          )}
        </div>
      )}

      {/* Chat */}
      <div className="min-h-0 flex-1">
        <ChatContainer
          roomUrl={roomUrl}
          messages={room.messages}
          sendMessage={async (text) => {
            await room.sendMessage(text)
            emitEvent('message-sent', { messageId: crypto.randomUUID() })
          }}
          onlineUsers={room.onlineUsers}
          groupState={room.groupState}
          windowEpoch={room.windowEpoch}
          isLoading={room.isLoading}
          isTransitioning={room.isTransitioning}
          messagingReady={room.messagingReady}
          error={room.error}
          showResyncCta={room.showResyncCta}
          onResyncConversation={room.resyncConversation}
          isResyncing={room.isResyncing}
          showInitRetryCta={room.showInitRetryCta}
          onRetryConversationInit={room.retryConversationInit}
        />
      </div>
    </div>
  )
}
