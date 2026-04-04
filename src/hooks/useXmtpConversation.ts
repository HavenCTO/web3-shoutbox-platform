import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { useChatStore } from '@/stores/chatStore'
import {
  DEFAULT_WAIT_FOR_GROUP_OPTIONS,
  waitForGroupConversation,
} from '@/lib/waitForGroupConversation'
import {
  getGroupMessages,
  sendMessage as serviceSendMessage,
  streamGroupMessages,
} from '@/services/messagingService'
import type { Group } from '@xmtp/browser-sdk'

/**
 * Hook that manages a single XMTP group conversation's lifecycle.
 * Loads existing messages and streams new ones when a groupId is provided.
 */
export function useXmtpConversation(groupId: string | null) {
  const { client } = useXmtpClient()
  const { messages, isLoading, error, addMessage, setMessages, clearMessages, setLoading, setError } = useChatStore()
  const unsubRef = useRef<(() => void) | null>(null)
  const groupRef = useRef<Group | null>(null)
  const [messagingReady, setMessagingReady] = useState(false)

  // Load messages and start stream when groupId changes
  useEffect(() => {
    unsubRef.current?.()
    unsubRef.current = null
    groupRef.current = null
    setMessagingReady(false)
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
          setMessagingReady(false)
          return
        }

        const group = conversation as Group
        groupRef.current = group

        const result = await getGroupMessages(group)
        if (cancelled) return

        if (result.ok) {
          setMessages(result.data)
        } else {
          setError(result.error.message)
          setMessagingReady(false)
          return
        }

        const { unsubscribe } = streamGroupMessages(group, (msg) => {
          if (!cancelled) addMessage(msg)
        })
        unsubRef.current = unsubscribe
        if (!cancelled) setMessagingReady(true)
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e)
          setError(msg)
          setMessagingReady(false)
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
      if (!groupRef.current) {
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
