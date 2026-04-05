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
  resolveGroupConflict,
  shouldDeferGroupCreation,
  CREATION_GATE_DEBOUNCE_MS,
} from '@/services/groupLifecycleService'
import { subscribeToGroup } from '@/lib/group-lifecycle'
import { teardownActiveGroupForWindowTransition } from '@/lib/windowTransitionTeardown'

const WINDOW_MINUTES = Number(import.meta.env.VITE_SLIDING_WINDOW_MINUTES) || 5
const LEADER_FAILOVER_TIMEOUT_MS = 15_000
const TRANSITION_BUFFER_MS = 30_000
const RETRY_DELAY_MS = 3_000

/**
 * Orchestrates the full group lifecycle including the sliding window model:
 *   IDLE → WAITING_FOR_PEERS → WAITING_FOR_GROUP → ACTIVE → EXPIRING → TRANSITIONING → ACTIVE
 *
 * **Deferred creation (v2):**
 *  - MLS group creation is gated on `MIN_PARTICIPANTS` distinct online inboxes.
 *  - The gate must be stable for `CREATION_GATE_DEBOUNCE_MS` before the leader
 *    actually calls `createGroupAsLeader`.
 *  - Once a `groupId` is set for the epoch (**latch**), the gate is permanently
 *    satisfied — the group is never torn down because the online count dips.
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

  // ── Debounce tracking for the creation gate ──
  /** Timestamp when we first observed >= MIN_PARTICIPANTS stably online. */
  const gateMetSinceRef = useRef<number | null>(null)
  const gateDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Latch: once a group is activated for this lifecycle, never revert to deferred ──
  const latchedRef = useRef(false)

  const clearTimers = useCallback(() => {
    if (expiringTimerRef.current) {
      clearTimeout(expiringTimerRef.current)
      expiringTimerRef.current = null
    }
    if (expireTimerRef.current) {
      clearTimeout(expireTimerRef.current)
      expireTimerRef.current = null
    }
    if (gateDebounceTimerRef.current) {
      clearTimeout(gateDebounceTimerRef.current)
      gateDebounceTimerRef.current = null
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

      // Latch: group is now live for this epoch — never revert to deferred
      latchedRef.current = true

      // Clear gate debounce since we no longer need it
      if (gateDebounceTimerRef.current) {
        clearTimeout(gateDebounceTimerRef.current)
        gateDebounceTimerRef.current = null
      }
      gateMetSinceRef.current = null

      // Clear expiration timers and re-schedule
      if (expiringTimerRef.current) {
        clearTimeout(expiringTimerRef.current)
        expiringTimerRef.current = null
      }
      if (expireTimerRef.current) {
        clearTimeout(expireTimerRef.current)
        expireTimerRef.current = null
      }

      const now = Date.now()
      const msUntilExpiry = groupWindow.expiresAt - now
      const msUntilExpiring = msUntilExpiry - TRANSITION_BUFFER_MS

      if (msUntilExpiry <= 0) {
        teardownActiveGroupForWindowTransition({
          setActiveGroupId,
          setActiveGroup,
        })
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
        teardownActiveGroupForWindowTransition({
          setActiveGroupId,
          setActiveGroup,
        })
        setGroupState('transitioning')
      }, msUntilExpiry)
    },
    [setActiveGroup],
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
  // This effect runs when the room is ready but no group is active yet.
  // It first checks GunDB for an existing group; if none, it waits for
  // the creation gate (deferred until MIN_PARTICIPANTS) before creating.
  useEffect(() => {
    if (!roomKey || status !== 'ready' || !client || !inboxId) {
      setGroupState('idle')
      setActiveGroupId(null)
      setActiveGroup(null)
      setCurrentWindow(null)
      latchedRef.current = false
      gateMetSinceRef.current = null
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

        // 2. No valid group — check the creation gate before proceeding.
        //    If we should defer, transition to 'waiting-for-peers' and let the
        //    gate watcher effect (below) handle the rest.
        if (shouldDeferGroupCreation(onlineUsers, inboxId, false)) {
          setGroupState('waiting-for-peers')
          // Don't proceed to create — the gate watcher will trigger creation
          return
        }

        // 3. Gate already satisfied — leader creates, non-leader waits
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

  // ── Creation gate watcher ──
  // While in 'waiting-for-peers', watches presence and applies a debounced
  // gate.  Once MIN_PARTICIPANTS is stably met for CREATION_GATE_DEBOUNCE_MS
  // the leader proceeds to create the group.  Non-leaders wait via failover.
  useEffect(() => {
    if (groupState !== 'waiting-for-peers') {
      // Not in deferred state — clear gate tracking
      gateMetSinceRef.current = null
      if (gateDebounceTimerRef.current) {
        clearTimeout(gateDebounceTimerRef.current)
        gateDebounceTimerRef.current = null
      }
      return
    }

    if (!roomKey || !client || !inboxId) return

    // Check if latch is already set (shouldn't happen but safety)
    if (latchedRef.current) return

    const deferred = shouldDeferGroupCreation(onlineUsers, inboxId, false)

    if (deferred) {
      // Condition not met — reset debounce tracking
      gateMetSinceRef.current = null
      if (gateDebounceTimerRef.current) {
        clearTimeout(gateDebounceTimerRef.current)
        gateDebounceTimerRef.current = null
      }
      return
    }

    // Condition met. Start or continue debounce.
    const now = Date.now()
    if (gateMetSinceRef.current === null) {
      gateMetSinceRef.current = now
    }

    const elapsed = now - gateMetSinceRef.current
    const remaining = CREATION_GATE_DEBOUNCE_MS - elapsed

    if (remaining <= 0) {
      // Gate debounce satisfied — proceed to create
      proceedToCreate()
      return
    }

    // Wait for the remaining debounce period
    if (gateDebounceTimerRef.current) {
      clearTimeout(gateDebounceTimerRef.current)
    }
    gateDebounceTimerRef.current = setTimeout(() => {
      gateDebounceTimerRef.current = null
      // Re-check that the condition still holds
      const stillDeferred = shouldDeferGroupCreation(
        usePresenceStore.getState().onlineUsers,
        inboxId,
        latchedRef.current,
      )
      if (!stillDeferred && groupState === 'waiting-for-peers') {
        proceedToCreate()
      } else {
        // Condition no longer met — reset
        gateMetSinceRef.current = null
      }
    }, remaining)

    function proceedToCreate() {
      if (runningRef.current) return
      runningRef.current = true
      gateMetSinceRef.current = null

      setGroupState('waiting-for-group')

      const currentOnlineUsers = usePresenceStore.getState().onlineUsers

      const doCreate = async () => {
        try {
          // One more GunDB check — someone else might have created while we debounced
          const existing = await getCurrentGroupForRoom(gun, roomKey!)
          if (existing.ok && existing.data) {
            const joinResult = await discoverAndJoinGroup(client!, gun, roomKey!)
            if (joinResult.ok) {
              activateWindow(joinResult.data.groupWindow)
              return
            }
            if (joinResult.error.code === 'NOT_MEMBER_YET') {
              activateWindow(existing.data)
              return
            }
          }

          if (isLeader) {
            const result = await createGroupAsLeader(
              client!, gun, roomKey!, currentOnlineUsers, 1, WINDOW_MINUTES,
            )
            if (result.ok) {
              activateWindow(result.data)
            } else {
              handleError(result.error.message, result.error.code)
            }
          } else {
            const result = await handleLeaderFailover(
              client!, gun, roomKey!, currentOnlineUsers, 1, WINDOW_MINUTES, LEADER_FAILOVER_TIMEOUT_MS,
            )
            if (result.ok) {
              const joinResult = await discoverAndJoinGroup(client!, gun, roomKey!)
              if (joinResult.ok) {
                activateWindow(joinResult.data.groupWindow)
              } else {
                activateWindow(result.data)
              }
            } else {
              handleError(result.error.message, result.error.code)
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          handleError(msg)
        } finally {
          runningRef.current = false
        }
      }

      void doCreate()
    }

    return () => {
      if (gateDebounceTimerRef.current) {
        clearTimeout(gateDebounceTimerRef.current)
        gateDebounceTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupState, onlineUsers, roomKey, client, inboxId, isLeader])

  // ── Window transition logic ──
  useEffect(() => {
    if (groupState !== 'transitioning' || !roomKey || !client || !inboxId) return

    // Reset latch for the new epoch — creation gate applies again
    latchedRef.current = false
    gateMetSinceRef.current = null

    let cancelled = false

    const transition = async () => {
      const nextEpoch = currentWindow ? calculateNextEpoch(currentWindow.epoch) : 1

      transitionToEpoch(nextEpoch)

      // For transitions, check the creation gate before creating a new epoch group.
      // If we should defer, enter waiting-for-peers for the new epoch.
      if (shouldDeferGroupCreation(onlineUsers, inboxId, false)) {
        setGroupState('waiting-for-peers')
        return
      }

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
      if (!data) return

      // If we are in 'waiting-for-peers' and a group appears (created by another
      // leader who saw the gate pass), adopt it immediately.
      if (groupState === 'waiting-for-peers') {
        if (!isGroupExpired(data)) {
          activateWindow(data)
        }
        return
      }

      if (!currentWindow) return
      if (isGroupExpired(data)) return

      if (data.epoch > currentWindow.epoch) {
        // New epoch — adopt unconditionally
        transitionToEpoch(data.epoch)
        activateWindow(data)
      } else if (
        data.epoch === currentWindow.epoch &&
        data.groupId !== currentWindow.groupId
      ) {
        // Same-epoch conflict — deterministic tiebreaker (lowest groupId wins)
        const winner = resolveGroupConflict(currentWindow, data)
        if (winner.groupId !== currentWindow.groupId) {
          activateWindow(winner)
        }
      }
    })

    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey, currentWindow?.epoch, currentWindow?.groupId, groupState])

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
