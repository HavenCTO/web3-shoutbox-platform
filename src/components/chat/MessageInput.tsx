import { useState, useCallback, type KeyboardEvent } from 'react'
import { Send, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { GroupState } from '@/types/group'
import type { ConnectionStep } from '@/lib/chat-status'
import { getMessageInputPlaceholder } from '@/lib/messageInputPlaceholder'

interface MessageInputProps {
  onSend: (text: string) => Promise<void>
  isConnected: boolean
  xmtpReady: boolean
  groupState: GroupState
  /** Local XMTP group + stream ready (session can be active before this). */
  messagingReady: boolean
  /** When true, allow typing and queueing messages even if not fully connected */
  allowQueueing?: boolean
  /** Number of messages currently queued */
  queuedCount?: number
  /** When set, adjusts placeholder during progressive connect (e.g. matchmaking queue). */
  connectionStep?: ConnectionStep | null
}

export function MessageInput({
  onSend,
  isConnected,
  xmtpReady,
  groupState,
  messagingReady,
  allowQueueing = false,
  queuedCount = 0,
  connectionStep = null,
}: MessageInputProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const sessionOpen = groupState === 'active' || groupState === 'expiring'
  // Allow input when queueing is enabled, even if not fully ready
  const canType = isConnected && xmtpReady && sessionOpen && (messagingReady || allowQueueing)
  const canSend = canType && !sending
  const disabled = !canSend

  const send = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || !canSend) return
    setSending(true)
    try {
      await onSend(trimmed)
      setText('')
    } catch {
      toast.error('Message failed to send. Tap to retry.', {
        action: { label: 'Retry', onClick: () => void send() },
      })
    } finally {
      setSending(false)
    }
  }, [text, canSend, onSend])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="border-t border-gray-700 bg-gray-800">
      {/* Queued message indicator */}
      {queuedCount > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-amber-400/90 sm:px-3 sm:text-xs">
          <Clock className="h-3 w-3" />
          <span>{queuedCount} message{queuedCount > 1 ? 's' : ''} queued — will send when connected</span>
        </div>
      )}
      <div className="flex items-end gap-2 p-2 sm:p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={getMessageInputPlaceholder({
            isConnected,
            xmtpReady,
            groupState,
            messagingReady,
            allowQueueing,
            connectionStep,
          })}
          disabled={!canType}
          rows={1}
          className={cn(
            'focus-ring flex-1 resize-none rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-gray-100 sm:px-3 sm:py-2 sm:text-sm',
            'placeholder:text-gray-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'max-h-24 overflow-y-auto',
            // Subtle visual hint when queueing is active
            allowQueueing && !messagingReady && 'ring-1 ring-amber-500/30',
          )}
        />
        <button
          onClick={() => void send()}
          disabled={disabled || !text.trim()}
          className={cn(
            'focus-ring rounded-lg p-1.5 transition-colors sm:p-2',
            // Different color when queueing vs sending directly
            messagingReady
              ? 'bg-blue-600 hover:bg-blue-500'
              : allowQueueing
                ? 'bg-amber-600 hover:bg-amber-500'
                : 'bg-blue-600 hover:bg-blue-500',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
          aria-label={messagingReady ? 'Send message' : 'Queue message for when session is ready'}
          title={
            messagingReady
              ? 'Send message'
              : connectionStep === 'waiting-in-queue'
                ? 'Queue message — sends when the encrypted session finishes updating'
                : 'Queue message — will send when connected'
          }
        >
          {messagingReady ? (
            <Send className="h-4 w-4 text-white" />
          ) : allowQueueing ? (
            <Clock className="h-4 w-4 text-white" />
          ) : (
            <Send className="h-4 w-4 text-white" />
          )}
        </button>
      </div>
    </div>
  )
}
