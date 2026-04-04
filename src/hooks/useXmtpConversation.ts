import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { useChatStore } from '@/stores/chatStore'
import {
  DEFAULT_WAIT_FOR_GROUP_OPTIONS,
  waitForGroupConversation,
  sleep,
} from '@/lib/waitForGroupConversation'
import {
  DEFAULT_WAIT_MEMBERS_SETTLED_OPTIONS,
  waitForGroupMembersSettled,
} from '@/lib/waitForGroupMembersSettled'
import { syncGroupForMessaging } from '@/lib/xmtpGroupSync'
import { isConversationReadyForGroup } from '@/lib/conversationReadyGate'
import {
  POST_MEMBER_SETTLE_BUFFER_MS,
  READY_AFTER_STREAM_START_MS,
} from '@/hooks/xmtpConversationConstants'
import {
  getGroupMessages,
  sendMessage as serviceSendMessage,
  streamGroupMessages,
} from '@/services/messagingService'
import type { Group } from '@xmtp/browser-sdk'

export interface UseXmtpConversationOptions {
  /** Current room participants (Gün presence). MLS roster must include every online inbox before sending is allowed. */
  getRequiredInboxIds?: () => readonly string[]
}

const defaultRequiredInboxIds: () => readonly string[] = () => []

/**
 * Hook that manages a single XMTP group conversation's lifecycle.
 * Loads existing messages and streams new ones when a groupId is provided.
 */
export function useXmtpConversation(
  groupId: string | null,
  options: UseXmtpConversationOptions = {},
) {
  const { client } = useXmtpClient()
  const getRequiredRef = useRef(options.getRequiredInboxIds ?? defaultRequiredInboxIds)
  getRequiredRef.current = options.getRequiredInboxIds ?? defaultRequiredInboxIds
  const { messages, isLoading, error, addMessage, setMessages, clearMessages, setLoading, setError } = useChatStore()
  const unsubRef = useRef<(() => void) | null>(null)
  const groupRef = useRef<Group | null>(null)
  const groupIdRef = useRef<string | null>(null)
  const readyForGroupIdRef = useRef<string | null>(null)
  /** Group id for which sync + history + stream have completed; must match `groupId` to allow send. */
  const [readyForGroupId, setReadyForGroupId] = useState<string | null>(null)
  const messagingReady = isConversationReadyForGroup(groupId, readyForGroupId)

  groupIdRef.current = groupId

  // Load messages and start stream when groupId changes
  useEffect(() => {
    unsubRef.current?.()
    unsubRef.current = null
    groupRef.current = null
    setReadyForGroupId(null)
    readyForGroupIdRef.current = null
    clearMessages()

    if (!client || !groupId) return

    let cancelled = false

    const init = async () => {
      setLoading(true)
      setError(null)

      try {
        const conversation = await waitForGroupConversation(
          client,
          groupId,
          DEFAULT_WAIT_FOR_GROUP_OPTIONS,
          () => cancelled,
        )
        if (cancelled) return

        if (!conversation) {
          setError(
            "Couldn't open this chat yet. Wait a few seconds or refresh the page.",
          )
          setReadyForGroupId(null)
          readyForGroupIdRef.current = null
          return
        }

        const group = conversation as Group
        groupRef.current = group

        const synced = await syncGroupForMessaging(group, () => cancelled)
        if (cancelled) return
        if (!synced) {
          setError(
            "Couldn't sync this chat yet. Wait a few seconds — the room may still be opening.",
          )
          setReadyForGroupId(null)
          readyForGroupIdRef.current = null
          return
        }

        const membersOk = await waitForGroupMembersSettled(
          group,
          () => getRequiredRef.current(),
          () => cancelled,
          DEFAULT_WAIT_MEMBERS_SETTLED_OPTIONS,
        )
        if (cancelled) return
        if (!membersOk) {
          setError(
            'Waiting for everyone to join encrypted chat… If this lasts more than a minute, refresh the page.',
          )
          setReadyForGroupId(null)
          readyForGroupIdRef.current = null
          return
        }

        await sleep(POST_MEMBER_SETTLE_BUFFER_MS)
        if (cancelled) return

        try {
          await group.publishMessages()
        } catch {
          /* flush is best-effort */
        }

        const syncedAfterMembers = await syncGroupForMessaging(group, () => cancelled)
        if (cancelled) return
        if (!syncedAfterMembers) {
          setError(
            "Couldn't sync this chat after members joined. Try again in a few seconds.",
          )
          setReadyForGroupId(null)
          readyForGroupIdRef.current = null
          return
        }

        const result = await getGroupMessages(group)
        if (cancelled) return

        if (result.ok) {
          setMessages(result.data)
        } else {
          setError(result.error.message)
          setReadyForGroupId(null)
          readyForGroupIdRef.current = null
          return
        }

        const { unsubscribe } = streamGroupMessages(group, (msg) => {
          if (!cancelled) addMessage(msg)
        })
        unsubRef.current = unsubscribe

        await sleep(READY_AFTER_STREAM_START_MS)
        if (cancelled) return

        try {
          await group.sync()
        } catch {
          /* last catch-up before unlocking composer */
        }

        if (!cancelled && groupId) {
          setReadyForGroupId(groupId)
          readyForGroupIdRef.current = groupId
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e)
          setError(msg)
          setReadyForGroupId(null)
          readyForGroupIdRef.current = null
          toast.error('Connection issue — retrying...')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void init()

    return () => {
      cancelled = true
      unsubRef.current?.()
      unsubRef.current = null
    }
  }, [client, groupId, addMessage, setMessages, clearMessages, setLoading, setError])

  const sendMessage = useCallback(
    async (text: string) => {
      const expectedId = groupIdRef.current
      if (
        !groupRef.current
        || !expectedId
        || readyForGroupIdRef.current !== expectedId
      ) {
        toast.info('Chat is still connecting…')
        return
      }
      const result = await serviceSendMessage(groupRef.current, text)
      if (!result.ok) {
        const errMsg = result.error.code === 'XMTP_RATE_LIMIT'
          ? 'Slow down — too many operations. Waiting...'
          : 'Message failed to send. Tap to retry.'
        toast.error(errMsg)
        setError(result.error.message)
      }
    },
    [setError],
  )

  return { messages, sendMessage, isLoading, error, messagingReady }
}
