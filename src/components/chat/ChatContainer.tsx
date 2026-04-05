import { useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { buildInboxAddressLookup } from '@/lib/inbox-display'
import {
  getChatConnectingBannerText,
  getChatStatusPresentation,
  shouldShowChatConnectingBanner,
} from '@/lib/chat-status'
import type { ConnectionStep } from '@/lib/chat-status'
import { MessageList } from '@/components/chat/MessageList'
import { MessageInput } from '@/components/chat/MessageInput'
import { PresencePanel } from '@/components/presence/PresencePanel'
import { MessageSkeleton } from '@/components/ui/Skeleton'
import { Loader2, Clock, Users } from 'lucide-react'
import type { GroupState } from '@/types/group'
import type { ShoutboxMessage } from '@/types/message'
import type { OnlineUser } from '@/types/presence'

export interface ChatContainerProps {
  roomUrl: string
  messages: ShoutboxMessage[]
  sendMessage: (text: string) => Promise<void>
  onlineUsers: OnlineUser[]
  groupState: GroupState
  windowEpoch: number
  isLoading: boolean
  isTransitioning: boolean
  /** True when the local XMTP group is loaded and the message stream is active. */
  messagingReady: boolean
  error: string | null
  /** When true with an error, show a Resync control for MLS/decrypt-style failures. */
  showResyncCta?: boolean
  onResyncConversation?: () => void | Promise<void>
  isResyncing?: boolean
  /** When true with an error, show Retry to re-run conversation init (e.g. member roster timeout). */
  showInitRetryCta?: boolean
  onRetryConversationInit?: () => void
  /** Progressive connection step for UX indicators */
  connectionStep?: ConnectionStep | null
  /** True when auto-recovering from a transient MLS error */
  isAutoRecovering?: boolean
  /** Number of messages queued while connecting */
  queuedMessageCount?: number
}

export function ChatContainer({
  messages, sendMessage, onlineUsers, groupState,
  windowEpoch, isLoading, isTransitioning, messagingReady, error,
  showResyncCta = false,
  onResyncConversation,
  isResyncing = false,
  showInitRetryCta = false,
  onRetryConversationInit,
  connectionStep = null,
  isAutoRecovering = false,
  queuedMessageCount = 0,
}: ChatContainerProps) {
  const { isConnected, address } = useAccount()
  const { inboxId, status: xmtpStatus } = useXmtpClient()

  const inboxToAddress = useMemo(
    () => buildInboxAddressLookup(onlineUsers, inboxId, address ?? null),
    [onlineUsers, inboxId, address],
  )

  const isSettingUp = groupState === 'waiting-for-group' || groupState === 'idle'

  // Don't show hard errors when auto-recovering
  const hasConversationError = Boolean(error) && !isAutoRecovering
  const { dotClassName, statusText } = getChatStatusPresentation({
    groupState,
    onlineCount: onlineUsers.length,
    hasConversationError,
    isMessagingReady: messagingReady,
    isLoadingConversation: isLoading,
    connectionStep,
    isAutoRecovering,
  })

  const showConnectingBanner = shouldShowChatConnectingBanner({
    groupState,
    isMessagingReady: messagingReady,
    hasConversationError,
    isAutoRecovering,
  })

  const bannerText = getChatConnectingBannerText(connectionStep)

  return (
    <div className="flex h-full flex-col bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-2 py-1.5 sm:px-3 sm:py-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dotClassName}`} />
          <span className="text-[10px] text-gray-300 sm:text-xs">{statusText}</span>
        </div>
        <div className="flex items-center gap-2">
          {queuedMessageCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 sm:text-xs">
              <Clock className="h-3 w-3" />
              {queuedMessageCount} queued
            </span>
          )}
          {windowEpoch > 0 && (
            <span className="text-[10px] text-gray-500">#{windowEpoch}</span>
          )}
        </div>
      </div>

      {/* Presence — collapsed to count on narrow, expandable */}
      <PresencePanel onlineUsers={onlineUsers} currentInboxId={inboxId} />

      {/* Error banner — only show for non-auto-recovering errors */}
      {error && !isAutoRecovering && (
        <div className="flex flex-wrap items-center gap-2 bg-red-900/40 px-2 py-1 text-[10px] text-red-300 sm:px-3 sm:py-1.5 sm:text-xs">
          <span className="min-w-0 flex-1">{error}</span>
          {showInitRetryCta && onRetryConversationInit && (
            <button
              type="button"
              onClick={onRetryConversationInit}
              className="shrink-0 rounded border border-red-400/60 bg-red-950/50 px-2 py-0.5 text-[10px] font-medium text-red-100 hover:bg-red-900/60 sm:text-xs"
            >
              Retry
            </button>
          )}
          {showResyncCta && onResyncConversation && (
            <button
              type="button"
              onClick={() => void onResyncConversation()}
              disabled={isResyncing}
              className="shrink-0 rounded border border-red-400/60 bg-red-950/50 px-2 py-0.5 text-[10px] font-medium text-red-100 hover:bg-red-900/60 disabled:opacity-60 sm:text-xs"
            >
              {isResyncing ? 'Resyncing…' : 'Resync'}
            </button>
          )}
        </div>
      )}

      {/* Auto-recovery banner — soft, non-alarming */}
      {isAutoRecovering && (
        <div className="flex items-center gap-2 border-b border-sky-900/50 bg-sky-950/40 px-2 py-1.5 text-[10px] text-sky-200/95 sm:px-3 sm:py-2 sm:text-xs">
          <Loader2 className="h-3 w-3 animate-spin text-sky-400" />
          <span>Syncing encryption state — this usually resolves in a few seconds.</span>
        </div>
      )}

      {/* Connecting banner with progressive step info */}
      {showConnectingBanner && (
        <div className="border-b border-sky-900/50 bg-sky-950/40 px-2 py-1.5 sm:px-3 sm:py-2">
          <div className="flex items-center gap-2 text-[10px] text-sky-200/95 sm:text-xs">
            {connectionStep === 'waiting-in-queue' ? (
              <span className="flex shrink-0 items-center gap-1" aria-hidden>
                <Users className="h-3 w-3 text-amber-400/90" />
                <Loader2 className="h-3 w-3 animate-spin text-sky-400" />
              </span>
            ) : (
              <Loader2 className="h-3 w-3 animate-spin text-sky-400 shrink-0" />
            )}
            <span>{bannerText}</span>
          </div>
          {/* Connection progress dots */}
          {connectionStep && connectionStep !== 'ready' && (
            <div className="flex items-center gap-1.5 mt-1.5 px-5">
              <ConnectionProgressDot active={connectionStep === 'finding-peers'} completed={isStepCompleted('finding-peers', connectionStep)} />
              <div className="h-px w-3 bg-gray-600" />
              <ConnectionProgressDot active={connectionStep === 'establishing-encryption'} completed={isStepCompleted('establishing-encryption', connectionStep)} />
              <div className="h-px w-3 bg-gray-600" />
              <ConnectionProgressDot active={connectionStep === 'waiting-in-queue'} completed={isStepCompleted('waiting-in-queue', connectionStep)} />
              <div className="h-px w-3 bg-gray-600" />
              <ConnectionProgressDot active={connectionStep === 'syncing-history'} completed={isStepCompleted('syncing-history', connectionStep)} />
              <div className="h-px w-3 bg-gray-600" />
              <ConnectionProgressDot active={connectionStep === 'finalizing'} completed={false} />
            </div>
          )}
        </div>
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

      {/* Input — always at bottom, allows typing while connecting for queueing */}
      <MessageInput
        onSend={sendMessage}
        isConnected={isConnected}
        xmtpReady={xmtpStatus === 'ready'}
        groupState={groupState}
        messagingReady={messagingReady}
        allowQueueing={!messagingReady && groupState === 'active'}
        queuedCount={queuedMessageCount}
        connectionStep={connectionStep}
      />
    </div>
  )
}

const STEP_ORDER: ConnectionStep[] = [
  'finding-peers',
  'establishing-encryption',
  'waiting-in-queue',
  'syncing-history',
  'finalizing',
  'ready',
]

function isStepCompleted(step: ConnectionStep, currentStep: ConnectionStep): boolean {
  const stepIndex = STEP_ORDER.indexOf(step)
  const currentIndex = STEP_ORDER.indexOf(currentStep)
  return stepIndex < currentIndex
}

function ConnectionProgressDot({ active, completed }: { active: boolean; completed: boolean }) {
  if (completed) {
    return <span className="h-2 w-2 rounded-full bg-green-500" />
  }
  if (active) {
    return <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
  }
  return <span className="h-2 w-2 rounded-full bg-gray-600" />
}
