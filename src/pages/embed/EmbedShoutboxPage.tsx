import { useEffect, useRef, useMemo } from 'react'
import { useEmbed } from '@/hooks/useEmbed'
import { useGunPresenceSyncStore } from '@/stores/gunPresenceSyncStore'
import { useShoutboxRoom } from '@/hooks/useShoutboxRoom'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { ChatContainer } from '@/components/chat/ChatContainer'
import { PlayerDock } from '@/components/chat/PlayerDock'
import { resolveRoom as resolveAllowedRoom } from '@/lib/roomPolicy'

/**
 * The room this embed opens.
 *
 * A command from the embedding page wins, then its config. The old third
 * fallback — the embedding page's `document.referrer` — is gone: it invented
 * a room out of whatever host happened to embed the widget, which is how
 * strangers' pages became shoutbox rooms. Anything unrecognized now lands on
 * the deployment's own room instead.
 */
function resolveRoom(configRoom?: string, commandRoom?: string): string {
  return resolveAllowedRoom(commandRoom || configRoom)
}

export function EmbedShoutboxPage() {
  const rootRef = useRef<HTMLDivElement>(null)
  const { embedConfig, emitEvent, enableAutoResize, commandRoom, commandTheme } = useEmbed()
  const { status: xmtpStatus, retry } = useXmtpClient()

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

  const bg = isDark ? 'bg-void-sunk text-ink' : 'bg-paper text-ink-paper'

  // XMTP failed — chat renders immediately otherwise; joining runs in the background.
  if (xmtpStatus === 'error') {
    return (
      <div
        ref={rootRef}
        className={`animate-fade-in flex h-screen w-screen flex-col items-center justify-center gap-3 p-3 ${bg}`}
        style={{ maxHeight: maxHeight ? `${maxHeight}px` : undefined, minWidth: 280 }}
      >
        <p className={`text-xs sm:text-sm ${isDark ? 'text-ink-muted' : 'text-ink-faint'}`}>
          Couldn’t join the chat
        </p>
        <button
          onClick={retry}
          className="focus-ring rounded-lg bg-ember px-3 py-1.5 text-sm font-medium text-ember-ink hover:bg-ember-lift transition-colors sm:px-4 sm:py-2 sm:text-sm"
        >
          Try again
        </button>
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
          className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b px-2 py-0.5 text-xs sm:px-3 sm:py-1 sm:text-xs ${isDark ? 'border-void-high bg-void-container text-ink-muted' : 'border-paper-high bg-paper text-ink-faint'}`}
        >
          <span className="inline-flex items-center gap-1">
            <span
              className={`h-1.5 w-1.5 rounded-full ${presenceDegraded ? 'bg-evm' : 'bg-arkiv'}`}
            />
            {room.onlineUsers.length} online
          </span>
          {presenceDegraded && (
            <span className={isDark ? 'text-evm' : 'text-evm'}>Presence relay unreachable</span>
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
          connectionStep={room.connectionStep}
          isAutoRecovering={room.isAutoRecovering}
          queuedMessageCount={room.queuedMessageCount}
        />
      </div>
      <PlayerDock />
    </div>
  )
}
