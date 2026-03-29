import { useEffect, useState, useCallback } from 'react'
import { hashUrl } from '@/lib/url-utils'
import { usePresence } from '@/hooks/usePresence'
import { useOnlineUsers } from '@/hooks/useOnlineUsers'
import { useGroupLifecycle } from '@/hooks/useGroupLifecycle'
import { useXmtpConversation } from '@/hooks/useXmtpConversation'
import { useLeaderElection } from '@/hooks/useLeaderElection'
import { usePresenceStore } from '@/stores/presenceStore'
import { useChatStore } from '@/stores/chatStore'

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

  // Conversation: load messages + stream for the active group
  const { messages, sendMessage: rawSendMessage, isLoading, error: conversationError } = useXmtpConversation(activeGroupId)

  // Leader election state
  const { isLeader } = useLeaderElection()
  const onlineUsers = usePresenceStore((s) => s.onlineUsers)
  const windowEpoch = useChatStore((s) => s.windowEpoch)

  // Block sends during transition
  const sendMessage = useCallback(
    async (text: string) => {
      if (groupState === 'transitioning') return
      return rawSendMessage(text)
    },
    [groupState, rawSendMessage],
  )

  const isTransitioning = groupState === 'transitioning'

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
    error: groupError ?? conversationError ?? null,
  }
}
