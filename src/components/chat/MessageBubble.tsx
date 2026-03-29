import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/presence/UserAvatar'
import type { ShoutboxMessage } from '@/types/message'

interface MessageBubbleProps {
  message: ShoutboxMessage
  isMine: boolean
}

function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function MessageBubble({ message, isMine }: MessageBubbleProps) {
  return (
    <div className={cn(
      'animate-fade-in-up flex flex-col gap-1 max-w-[85%] sm:max-w-[80%]',
      isMine ? 'ml-auto items-end' : 'mr-auto items-start',
    )}>
      {!isMine && (
        <UserAvatar address={message.senderAddress} showOnlineIndicator={false} />
      )}
      <div
        className={cn(
          'rounded-2xl px-2.5 py-1.5 text-xs break-words whitespace-pre-wrap sm:px-3 sm:py-2 sm:text-sm',
          isMine
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-gray-700 text-gray-100 rounded-bl-sm',
        )}
      >
        {message.content}
      </div>
      <span className="text-[10px] text-gray-500 px-1">{formatTimestamp(message.timestamp)}</span>
    </div>
  )
}
