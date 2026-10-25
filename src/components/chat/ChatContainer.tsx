import { useMemo } from 'react'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { useAuthStore } from '@/stores/authStore'
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
import { Loader2, Clock } from 'lucide-react'
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
  roomUrl, messages, sendMessage, onlineUsers, groupState,
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
  const address = useAuthStore((s) => s.address)
  const isConnected = Boolean(address)
  const { inboxId, status: xmtpStatus } = useXmtpClient()

  const inboxToAddress = useMemo(
    () => buildInboxAddressLookup(onlineUsers, inboxId, address ?? null),
    [onlineUsers, inboxId, address],
  )

  const isSettingUp = groupState === 'waiting-for-group' || groupState === 'idle'
  const isWaitingForPeers = groupState === 'waiting-for-peers'

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
    <div className="flex h-full flex-col bg-void-sunk rounded-lg border border-void-high overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center justify-between border-b border-void-high bg-void-container px-2 py-1.5 sm:px-3 sm:py-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dotClassName}`} />
          <span className="text-sm text-ink">{statusText}</span>
        </div>
        <div className="flex items-center gap-2">
          {queuedMessageCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-evm sm:text-xs">
              <Clock className="h-3 w-3" />
              {queuedMessageCount} queued
            </span>
          )}
          {windowEpoch > 0 && (
            <span className="text-xs text-ink-muted">#{windowEpoch}</span>
          )}
        </div>
      </div>

      {/* Presence — collapsed to count on narrow, expandable */}
      <PresencePanel onlineUsers={onlineUsers} currentInboxId={inboxId} />

      {/* Error banner — only show for non-auto-recovering errors */}
      {error && !isAutoRecovering && (
        <div className="flex flex-wrap items-center gap-2 bg-alert/15 px-2 py-1 text-xs text-alert sm:px-3 sm:py-1.5 sm:text-xs">
          <span className="min-w-0 flex-1">{error}</span>
          {showInitRetryCta && onRetryConversationInit && (
            <button
              type="button"
              onClick={onRetryConversationInit}
              className="shrink-0 rounded border border-alert/60 bg-alert/10 px-2 py-0.5 text-xs font-medium text-ink hover:bg-alert/25 sm:text-xs"
            >
              Retry
            </button>
          )}
          {showResyncCta && onResyncConversation && (
            <button
              type="button"
              onClick={() => void onResyncConversation()}
              disabled={isResyncing}
              className="shrink-0 rounded border border-alert/60 bg-alert/10 px-2 py-0.5 text-xs font-medium text-ink hover:bg-alert/25 disabled:opacity-60 sm:text-xs"
            >
              {isResyncing ? 'Resyncing…' : 'Resync'}
            </button>
          )}
        </div>
      )}

      {/* Auto-recovery banner — soft, non-alarming */}
      {isAutoRecovering && (
        <div className="flex items-center gap-2 border-b border-arkiv/30 bg-arkiv/10 px-2 py-1.5 text-xs text-arkiv sm:px-3 sm:py-2 sm:text-xs">
          <Loader2 className="h-3 w-3 animate-spin text-arkiv" />
          <span>Syncing encryption state — this usually resolves in a few seconds.</span>
        </div>
      )}

      {/* Connecting banner with progressive step info */}
      {showConnectingBanner && (
        <div className="border-b border-arkiv/30 bg-arkiv/10 px-2 py-1.5 sm:px-3 sm:py-2">
          <div className="flex items-center gap-2 text-xs text-arkiv sm:text-xs">
            <Loader2 className="h-3 w-3 animate-spin text-arkiv shrink-0" />
            <span>{bannerText}</span>
          </div>
          {/* Connection progress dots */}
          {connectionStep && connectionStep !== 'ready' && (
            <div className="flex items-center gap-1.5 mt-1.5 px-5">
              <ConnectionProgressDot active={connectionStep === 'finding-peers'} completed={isStepCompleted('finding-peers', connectionStep)} />
              <div className="h-px w-3 bg-void-highest" />
              <ConnectionProgressDot active={connectionStep === 'establishing-encryption'} completed={isStepCompleted('establishing-encryption', connectionStep)} />
              <div className="h-px w-3 bg-void-highest" />
              <ConnectionProgressDot active={connectionStep === 'syncing-members'} completed={isStepCompleted('syncing-members', connectionStep)} />
              <div className="h-px w-3 bg-void-highest" />
              <ConnectionProgressDot active={connectionStep === 'syncing-history'} completed={isStepCompleted('syncing-history', connectionStep)} />
              <div className="h-px w-3 bg-void-highest" />
              <ConnectionProgressDot active={connectionStep === 'finalizing'} completed={false} />
            </div>
          )}
        </div>
      )}

      {/* Waiting for peers — deferred MLS creation */}
      {isWaitingForPeers ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-4">
          <div className="flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-arkiv" />
          </div>
          <p className="text-sm font-medium text-ink">Waiting for others to join…</p>
          <p className="text-sm text-ink-muted text-center max-w-sm">
            Encrypted chat will start when another person enters the room.
            You can type a message now. It will send automatically.
          </p>
          <button
            type="button"
            onClick={() => { void navigator.clipboard?.writeText(roomUrl) }}
            className="focus-ring rounded-md bg-ember px-4 py-2 text-sm font-medium text-ember-ink transition-colors hover:bg-ember-lift"
          >
            Copy room link to invite someone
          </button>
        </div>
      ) : isSettingUp && !isLoading ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-ember" />
          <p className="text-xs text-ink-muted">Setting up chat room…</p>
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

      {/* Input — always at bottom, allows typing while connecting or waiting for peers */}
      <MessageInput
        onSend={sendMessage}
        isConnected={isConnected}
        xmtpReady={xmtpStatus === 'ready'}
        groupState={groupState}
        messagingReady={messagingReady}
        allowQueueing={!messagingReady && (groupState === 'active' || isWaitingForPeers)}
        queuedCount={queuedMessageCount}
      />
    </div>
  )
}

const STEP_ORDER: ConnectionStep[] = [
  'waiting-in-queue',
  'finding-peers',
  'establishing-encryption',
  'syncing-members',
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
    return <span className="h-2 w-2 rounded-full bg-arkiv" />
  }
  if (active) {
    return <span className="h-2 w-2 rounded-full bg-arkiv animate-pulse" />
  }
  return <span className="h-2 w-2 rounded-full bg-void-highest" />
}
