import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/presence/UserAvatar'
import type { ShoutboxMessage } from '@/types/message'

interface MessageBubbleProps {
  message: ShoutboxMessage
  isMine: boolean
  /** Wallet address (or inbox fallback) for avatars and labels. */
  senderAddressResolved: string
  /** False when the previous message is from the same sender (compact run). */
  showSenderHeader: boolean
  /** Displayed address matches XMTP-registered identifiers for this sender inbox. */
  addressVerifiedByXmtp?: boolean
}

function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function MessageBubble({
  message,
  isMine,
  senderAddressResolved,
  showSenderHeader,
  addressVerifiedByXmtp = false,
}: MessageBubbleProps) {
  const showVerified = showSenderHeader && addressVerifiedByXmtp

  return (
    <div className={cn(
      'animate-fade-in-up flex flex-col gap-1 max-w-[85%] sm:max-w-[80%]',
      isMine ? 'ml-auto items-end' : 'mr-auto items-start',
      !showSenderHeader && 'mt-0.5',
    )}>
      {showSenderHeader && isMine && (
        <div className="px-1">
          <UserAvatar
            address={senderAddressResolved}
            showOnlineIndicator={false}
            suffix=" (you)"
            verifiedByXmtp={showVerified}
          />
        </div>
      )}
      {showSenderHeader && !isMine && (
        <div className="min-w-0">
          <UserAvatar
            address={senderAddressResolved}
            showOnlineIndicator={false}
            verifiedByXmtp={showVerified}
          />
        </div>
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
