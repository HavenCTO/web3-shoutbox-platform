import { useState, useCallback, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { GroupState } from '@/types/group'

interface MessageInputProps {
  onSend: (text: string) => Promise<void>
  isConnected: boolean
  xmtpReady: boolean
  groupState: GroupState
  /** Local XMTP group + stream ready (session can be active before this). */
  messagingReady: boolean
}

function getPlaceholder(
  isConnected: boolean,
  xmtpReady: boolean,
  groupState: GroupState,
  messagingReady: boolean,
): string {
  if (!isConnected) return 'Connect wallet to chat'
  if (!xmtpReady) return 'Setting up messaging…'
  if (groupState !== 'active' && groupState !== 'expiring') return 'Waiting for session…'
  if (!messagingReady) return 'Connecting to encrypted chat…'
  return 'Type a message…'
}

export function MessageInput({
  onSend,
  isConnected,
  xmtpReady,
  groupState,
  messagingReady,
}: MessageInputProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const sessionOpen = groupState === 'active' || groupState === 'expiring'
  const canSend = isConnected && xmtpReady && sessionOpen && messagingReady
  const disabled = !canSend || sending

  const send = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
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
  }, [text, disabled, onSend])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-gray-700 bg-gray-800 p-2 sm:p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={getPlaceholder(isConnected, xmtpReady, groupState, messagingReady)}
        disabled={!canSend}
        rows={1}
        className={cn(
          'focus-ring flex-1 resize-none rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-gray-100 sm:px-3 sm:py-2 sm:text-sm',
          'placeholder:text-gray-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'max-h-24 overflow-y-auto',
        )}
      />
      <button
        onClick={() => void send()}
        disabled={disabled || !text.trim()}
        className={cn(
          'focus-ring rounded-lg bg-blue-600 p-1.5 transition-colors sm:p-2',
          'hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed',
        )}
        aria-label="Send message"
      >
        <Send className="h-4 w-4 text-white" />
      </button>
    </div>
  )
}
