import { useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { buildInboxAddressLookup } from '@/lib/inbox-display'
import { MessageList } from '@/components/chat/MessageList'
import { MessageInput } from '@/components/chat/MessageInput'
import { PresencePanel } from '@/components/presence/PresencePanel'
import { MessageSkeleton } from '@/components/ui/Skeleton'
import { Loader2 } from 'lucide-react'
import type { GroupState } from '@/types/group'
import type { ShoutboxMessage } from '@/types/message'
import type { OnlineUser } from '@/types/presence'

function statusLabel(groupState: GroupState, onlineCount: number): string {
  switch (groupState) {
    case 'active':
    case 'expiring':
      return `Connected · ${onlineCount} online`
    case 'transitioning':
      return 'Switching sessions…'
    case 'waiting-for-group':
      return 'Setting up chat room…'
    default:
      return 'Connecting…'
  }
}

export interface ChatContainerProps {
  roomUrl: string
  messages: ShoutboxMessage[]
  sendMessage: (text: string) => Promise<void>
  onlineUsers: OnlineUser[]
  groupState: GroupState
  windowEpoch: number
  isLoading: boolean
  isTransitioning: boolean
  error: string | null
}

export function ChatContainer({
  messages, sendMessage, onlineUsers, groupState,
  windowEpoch, isLoading, isTransitioning, error,
}: ChatContainerProps) {
  const { isConnected, address } = useAccount()
  const { inboxId, status: xmtpStatus } = useXmtpClient()

  const inboxToAddress = useMemo(
    () => buildInboxAddressLookup(onlineUsers, inboxId, address ?? null),
    [onlineUsers, inboxId, address],
  )

  const isSettingUp = groupState === 'waiting-for-group' || groupState === 'idle'

  return (
    <div className="flex h-full flex-col bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-2 py-1.5 sm:px-3 sm:py-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${groupState === 'active' || groupState === 'expiring' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
          <span className="text-[10px] text-gray-300 sm:text-xs">{statusLabel(groupState, onlineUsers.length)}</span>
        </div>
        {windowEpoch > 0 && (
          <span className="text-[10px] text-gray-500">#{windowEpoch}</span>
        )}
      </div>

      {/* Presence — collapsed to count on narrow, expandable */}
      <PresencePanel onlineUsers={onlineUsers} />

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/40 px-2 py-1 text-[10px] text-red-300 sm:px-3 sm:py-1.5 sm:text-xs">{error}</div>
      )}

      {/* Skeleton for group setup */}
      {isSettingUp && !isLoading ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
          <p className="text-xs text-gray-400">Setting up chat room…</p>
          <MessageSkeleton count={3} />
        </div>
      ) : (
        <MessageList
          messages={messages}
          currentInboxId={inboxId}
          inboxToAddress={inboxToAddress}
          isLoading={isLoading}
          isTransitioning={isTransitioning}
          windowEpoch={windowEpoch}
        />
      )}

      {/* Input — always at bottom */}
      <MessageInput
        onSend={sendMessage}
        isConnected={isConnected}
        xmtpReady={xmtpStatus === 'ready'}
        groupState={groupState}
      />
    </div>
  )
}
