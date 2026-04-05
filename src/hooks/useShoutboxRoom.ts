import { useEffect, useState, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { hashUrl } from '@/lib/url-utils'
import { usePresence } from '@/hooks/usePresence'
import { useOnlineUsers } from '@/hooks/useOnlineUsers'
import { useGroupLifecycle } from '@/hooks/useGroupLifecycle'
import { useXmtpConversation } from '@/hooks/useXmtpConversation'
import { useLeaderElection } from '@/hooks/useLeaderElection'
import { usePresenceStore } from '@/stores/presenceStore'
import { useChatStore } from '@/stores/chatStore'
import { useGunPresenceSyncStore } from '@/stores/gunPresenceSyncStore'

const PRESENCE_RELAY_TOAST_ID = 'presence-relay-degraded'

/**
 * High-level orchestration hook for a single shoutbox room.
 * Ties together presence, group lifecycle, and conversation.
 *
 * During TRANSITIONING state, sendMessage is blocked and returns a status message.
 */
export function useShoutboxRoom(roomUrl: string) {
  const [roomKey, setRoomKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    hashUrl(roomUrl).then((key) => {
      if (!cancelled) setRoomKey(key)
    })
    return () => { cancelled = true }
  }, [roomUrl])

  // Presence
  usePresence(roomKey)
  useOnlineUsers(roomKey)

  // Group lifecycle with sliding window
  const { activeGroupId, groupState, currentWindow, error: groupError } = useGroupLifecycle(roomKey)

  const onlineUsers = usePresenceStore((s) => s.onlineUsers)
  const presenceSyncStatus = useGunPresenceSyncStore((s) => s.syncStatus)

  useEffect(() => {
    if (presenceSyncStatus === 'degraded') {
      toast.warning(
        'Presence relay unreachable — online count and host role may be wrong until the connection is restored.',
        { id: PRESENCE_RELAY_TOAST_ID, duration: 12_000 },
      )
    } else {
      toast.dismiss(PRESENCE_RELAY_TOAST_ID)
    }
  }, [presenceSyncStatus])

  const conversationOptions = useMemo(
    () => ({
      getRequiredInboxIds: (): readonly string[] =>
        onlineUsers.filter((u) => u.isOnline).map((u) => u.inboxId),
    }),
    [onlineUsers],
  )

  // Conversation: load messages + stream for the active group
  const {
    messages,
    sendMessage: rawSendMessage,
    isLoading,
    error: conversationError,
    messagingReady,
    connectionStep,
    isAutoRecovering,
    queuedMessageCount,
    showResyncCta: conversationShowResync,
    showInitRetryCta: conversationShowInitRetry,
    retryConversationInit,
    resyncConversation,
    isResyncing,
  } = useXmtpConversation(activeGroupId, conversationOptions)

  // Leader election state
  const { isLeader } = useLeaderElection()
  const windowEpoch = useChatStore((s) => s.windowEpoch)

  // Allow queueing during connection, block only during transition
  const sendMessage = useCallback(
    async (text: string) => {
      if (groupState === 'transitioning') return
      return rawSendMessage(text)
    },
    [groupState, rawSendMessage],
  )

  const isTransitioning = groupState === 'transitioning'

  const showResyncCta = conversationShowResync && !groupError
  const showInitRetryCta = conversationShowInitRetry && !groupError

  return {
    roomKey,
    messages,
    sendMessage,
    onlineUsers,
    groupState,
    activeGroupId,
    currentWindow,
    windowEpoch,
    isLeader,
    isLoading,
    isTransitioning,
    messagingReady,
    connectionStep,
    isAutoRecovering,
    queuedMessageCount,
    error: groupError ?? conversationError ?? null,
    showResyncCta,
    showInitRetryCta,
    retryConversationInit,
    resyncConversation,
    isResyncing,
  }
}
