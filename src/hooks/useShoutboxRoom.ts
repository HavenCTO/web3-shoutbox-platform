import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { hashUrl } from '@/lib/url-utils'
import { newMemberAddresses } from '@/lib/lateJoiner'
import { addBatchAllowed, pruneAddTimestamps } from '@/lib/memberAddHeat'
import { BRIDGE_ADDRESSES } from '@/lib/bridgeMembers'
import { addMembersToGroup } from '@/services/messagingService'
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
    activeGroup,
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

  // Late joiners: the leader adds newly-online members to the live group
  // instead of leaving them locked out until the next window epoch.
  // Attempted addresses are tracked per group so each add fires once;
  // a 3s settle lets the joiner's presence burst stabilize first.
  const attemptedAddsRef = useRef<{ groupId: string; attempted: Set<string>; addTimes: number[] } | null>(null)
  useEffect(() => {
    if (!isLeader || !activeGroup || !activeGroupId) return
    if (groupState !== 'active' && groupState !== 'expiring') return
    if (attemptedAddsRef.current?.groupId !== activeGroupId) {
      attemptedAddsRef.current = { groupId: activeGroupId, attempted: new Set(), addTimes: [] }
    }
    const state = attemptedAddsRef.current
    const adds = newMemberAddresses(onlineUsers, state.attempted, BRIDGE_ADDRESSES)
    if (adds.length === 0) return
    const timer = setTimeout(() => {
      // Heat check at fire time: identity-cycling must not force
      // unbounded MLS adds. Over budget, skip without marking attempted —
      // a later presence change retries after the cooldown.
      const now = Date.now()
      state.addTimes = pruneAddTimestamps(state.addTimes, now)
      if (!addBatchAllowed(state.addTimes, adds.length, now)) return
      for (const a of adds) {
        state.attempted.add(a)
        state.addTimes.push(now)
      }
      void addMembersToGroup(activeGroup, adds)
    }, 3_000)
    return () => clearTimeout(timer)
  }, [isLeader, activeGroup, activeGroupId, groupState, onlineUsers])

  // Allow queueing during connection and deferred state, block only during transition
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
