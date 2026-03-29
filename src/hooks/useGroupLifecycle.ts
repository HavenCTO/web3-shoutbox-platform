import { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useGun } from '@/hooks/useGun'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { useLeaderElection } from '@/hooks/useLeaderElection'
import { usePresenceStore } from '@/stores/presenceStore'
import { useChatStore } from '@/stores/chatStore'
import type { GroupState, GroupWindow } from '@/types/group'
import {
  getCurrentGroupForRoom,
  createGroupAsLeader,
  discoverAndJoinGroup,
  handleLeaderFailover,
  isGroupExpired,
  calculateNextEpoch,
} from '@/services/groupLifecycleService'
import { subscribeToGroup } from '@/lib/group-lifecycle'

const WINDOW_MINUTES = Number(import.meta.env.VITE_SLIDING_WINDOW_MINUTES) || 5
const LEADER_FAILOVER_TIMEOUT_MS = 15_000
const TRANSITION_BUFFER_MS = 30_000
const RETRY_DELAY_MS = 3_000

/**
 * Orchestrates the full group lifecycle including the sliding window model:
 *   IDLE → WAITING_FOR_GROUP → ACTIVE → EXPIRING → TRANSITIONING → ACTIVE
 */
export function useGroupLifecycle(roomKey: string | null) {
  const gun = useGun()
  const { client, inboxId, status } = useXmtpClient()
  const { isLeader } = useLeaderElection()
  const onlineUsers = usePresenceStore((s) => s.onlineUsers)
  const setActiveGroup = useChatStore((s) => s.setActiveGroup)
  const transitionToEpoch = useChatStore((s) => s.transitionToEpoch)

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [groupState, setGroupState] = useState<GroupState>('idle')
  const [currentWindow, setCurrentWindow] = useState<GroupWindow | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runningRef = useRef(false)
  const expiringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (expiringTimerRef.current) {
      clearTimeout(expiringTimerRef.current)
      expiringTimerRef.current = null
    }
    if (expireTimerRef.current) {
      clearTimeout(expireTimerRef.current)
      expireTimerRef.current = null
    }
  }, [])

  /** Activate a group window — set state, store, and schedule expiration timers. */
  const activateWindow = useCallback(
    (groupWindow: GroupWindow) => {
      setActiveGroupId(groupWindow.groupId)
      setActiveGroup(groupWindow.groupId)
      setCurrentWindow(groupWindow)
      setGroupState('active')
      setError(null)

      clearTimers()
      const now = Date.now()
      const msUntilExpiry = groupWindow.expiresAt - now
      const msUntilExpiring = msUntilExpiry - TRANSITION_BUFFER_MS

      if (msUntilExpiry <= 0) {
        setGroupState('transitioning')
        return
      }

      if (msUntilExpiring > 0) {
        expiringTimerRef.current = setTimeout(() => {
          setGroupState('expiring')
        }, msUntilExpiring)
      } else {
        setGroupState('expiring')
      }

      expireTimerRef.current = setTimeout(() => {
        setGroupState('transitioning')
      }, msUntilExpiry)
    },
    [setActiveGroup, clearTimers],
  )

  /** Handle errors with user-friendly toasts */
  const handleError = useCallback((msg: string, code?: string) => {
    setError(msg)
    if (code === 'XMTP_RATE_LIMIT') {
      toast.warning('Slow down — too many operations. Waiting...')
    } else if (code === 'XMTP_GROUP_FULL') {
      toast.info('Room is full. A new session will start soon.')
    } else if (msg.includes('taking longer')) {
      toast.loading('Setting up chat room is taking longer than expected...')
    }
  }, [])

  // ── Initial group creation / discovery ──
  useEffect(() => {
    if (!roomKey || status !== 'ready' || !client || !inboxId) {
      setGroupState('idle')
      setActiveGroupId(null)
      setActiveGroup(null)
      setCurrentWindow(null)
      clearTimers()
      return
    }

    if (activeGroupId && (groupState === 'active' || groupState === 'expiring')) return
    if (groupState === 'transitioning') return
    if (runningRef.current) return
    runningRef.current = true

    let cancelled = false

    const run = async () => {
      try {
        setGroupState('waiting-for-group')

        // 1. Check GunDB for an existing valid group
        const existing = await getCurrentGroupForRoom(gun, roomKey)
        if (cancelled) return

        if (existing.ok && existing.data) {
          const joinResult = await discoverAndJoinGroup(client, gun, roomKey)
          if (cancelled) return

          if (joinResult.ok) {
            activateWindow(joinResult.data.groupWindow)
            return
          }
          if (joinResult.error.code === 'NOT_MEMBER_YET') {
            activateWindow(existing.data)
            return
          }
        }

        // 2. No valid group — leader creates, non-leader waits
        if (isLeader) {
          const createResult = await createGroupAsLeader(
            client, gun, roomKey, onlineUsers, 1, WINDOW_MINUTES,
          )
          if (cancelled) return
          if (createResult.ok) {
            activateWindow(createResult.data)
          } else {
            handleError(createResult.error.message, createResult.error.code)
          }
        } else {
          const failoverResult = await handleLeaderFailover(
            client, gun, roomKey, onlineUsers, 1, WINDOW_MINUTES, LEADER_FAILOVER_TIMEOUT_MS,
          )
          if (cancelled) return
          if (failoverResult.ok) {
            const joinResult = await discoverAndJoinGroup(client, gun, roomKey)
            if (cancelled) return
            if (joinResult.ok) {
              activateWindow(joinResult.data.groupWindow)
            } else {
              activateWindow(failoverResult.data)
            }
          } else {
            handleError(failoverResult.error.message, failoverResult.error.code)
          }
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e)
          handleError(msg)
        }
      } finally {
        runningRef.current = false
      }
    }

    void run()
    return () => {
      cancelled = true
      runningRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey, status, inboxId, isLeader])

  // ── Window transition logic ──
  useEffect(() => {
    if (groupState !== 'transitioning' || !roomKey || !client || !inboxId) return

    let cancelled = false

    const transition = async () => {
      const nextEpoch = currentWindow ? calculateNextEpoch(currentWindow.epoch) : 1

      transitionToEpoch(nextEpoch)

      if (isLeader) {
        const result = await createGroupAsLeader(
          client, gun, roomKey, onlineUsers, nextEpoch, WINDOW_MINUTES,
        )
        if (cancelled) return
        if (result.ok) {
          activateWindow(result.data)
        } else {
          handleError(result.error.message, result.error.code)
        }
      } else {
        const result = await handleLeaderFailover(
          client, gun, roomKey, onlineUsers, nextEpoch, WINDOW_MINUTES, LEADER_FAILOVER_TIMEOUT_MS,
        )
        if (cancelled) return
        if (result.ok) {
          const joinResult = await discoverAndJoinGroup(client, gun, roomKey)
          if (cancelled) return
          if (joinResult.ok) {
            activateWindow(joinResult.data.groupWindow)
          } else {
            activateWindow(result.data)
          }
        } else {
          handleError(result.error.message, result.error.code)
        }
      }
    }

    void transition()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupState === 'transitioning'])

  // ── Watch GunDB for epoch changes from other leaders ──
  useEffect(() => {
    if (!roomKey || groupState === 'idle') return

    const unsub = subscribeToGroup(gun, roomKey, (data) => {
      if (!data || !currentWindow) return
      if (data.epoch > currentWindow.epoch && !isGroupExpired(data)) {
        transitionToEpoch(data.epoch)
        activateWindow(data)
      }
    })

    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey, currentWindow?.epoch, groupState])

  // ── Retry on error ──
  useEffect(() => {
    if (!error || !roomKey || groupState === 'active') return
    const timer = setTimeout(() => {
      setError(null)
      setGroupState('idle')
    }, RETRY_DELAY_MS)
    return () => clearTimeout(timer)
  }, [error, roomKey, groupState])

  // Cleanup timers on unmount
  useEffect(() => clearTimers, [clearTimers])

  return { activeGroupId, groupState, currentWindow, error }
}
