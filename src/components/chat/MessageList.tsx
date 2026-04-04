import { useEffect, useRef, useState, useCallback } from 'react'
import { ArrowDown, Loader2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveSenderAddressForDisplay } from '@/lib/inbox-display'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { MessageSkeleton } from '@/components/ui/Skeleton'
import type { ShoutboxMessage } from '@/types/message'

interface MessageListProps {
  messages: ShoutboxMessage[]
  currentInboxId: string | null
  /** Maps XMTP inbox id → wallet address (from presence + local wallet). */
  inboxToAddress: ReadonlyMap<string, string>
  isLoading: boolean
  isTransitioning: boolean
  windowEpoch: number
}

export function MessageList({
  messages,
  currentInboxId,
  inboxToAddress,
  isLoading,
  isTransitioning,
  windowEpoch,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [showSessionDivider, setShowSessionDivider] = useState(false)
  const prevEpochRef = useRef(windowEpoch)

  useEffect(() => {
    if (windowEpoch > prevEpochRef.current && prevEpochRef.current > 0) {
      setShowSessionDivider(true)
      const timer = setTimeout(() => setShowSessionDivider(false), 5000)
      return () => clearTimeout(timer)
    }
    prevEpochRef.current = windowEpoch
  }, [windowEpoch])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    if (isNearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 100)
  }, [])

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0">
        <MessageSkeleton count={4} />
      </div>
    )
  }

  return (
    <div className="relative flex flex-1 min-h-0">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="scrollbar-thin flex-1 overflow-y-auto px-2 py-2 space-y-3 sm:px-3"
      >
        {showSessionDivider && (
          <div className="animate-fade-in flex items-center gap-2 py-2">
            <div className="flex-1 border-t border-gray-600" />
            <span className="text-xs text-gray-400">New chat session started</span>
            <div className="flex-1 border-t border-gray-600" />
          </div>
        )}

        {isTransitioning && (
          <div className="animate-fade-in flex items-center justify-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            <span className="text-xs text-gray-400">Switching sessions…</span>
          </div>
        )}

        {messages.length === 0 && !isTransitioning && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-500">
            <MessageSquare className="h-8 w-8" />
            <p className="text-sm">No messages yet. Say hello! 👋</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMine = msg.senderInboxId === currentInboxId
          const prev = i > 0 ? messages[i - 1] : null
          const showSenderHeader = !prev || prev.senderInboxId !== msg.senderInboxId
          const senderAddressResolved = resolveSenderAddressForDisplay(msg.senderInboxId, inboxToAddress)
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isMine={isMine}
              senderAddressResolved={senderAddressResolved}
              showSenderHeader={showSenderHeader}
            />
          )
        })}
        <div ref={bottomRef} />
      </div>

      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className={cn(
            'focus-ring absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-gray-700 p-2',
            'shadow-lg hover:bg-gray-600 transition-colors',
          )}
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="h-4 w-4 text-gray-200" />
        </button>
      )}
    </div>
  )
}
