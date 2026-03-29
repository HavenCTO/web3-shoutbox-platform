/**
 * Presence Service
 *
 * Manages joining/leaving rooms and heartbeat lifecycle.
 * GunDB writes retry silently — presence is best-effort and must never block messaging.
 */

import type { GunInstance } from 'gun'
import { writePresence, clearPresence, subscribeToPresence, type GunPresenceData } from '@/lib/gun-presence'
import { PresenceError } from '@/types/errors'
import { type Result, ok, err } from '@/types/result'
import type { OnlineUser } from '@/types/presence'

const HEARTBEAT_INTERVAL_MS = 10_000
const MAX_WRITE_RETRIES = 2

let heartbeatTimer: ReturnType<typeof setInterval> | null = null

/** Silently retry a GunDB presence write */
function safeWritePresence(
  gun: GunInstance,
  roomKey: string,
  record: GunPresenceData,
  retries = MAX_WRITE_RETRIES,
): void {
  try {
    writePresence(gun, roomKey, record)
  } catch {
    if (retries > 0) {
      setTimeout(() => safeWritePresence(gun, roomKey, record, retries - 1), 1000)
    }
    // Silently swallow — presence is best-effort
  }
}

/** Start a recurring heartbeat that updates the ts field every 10 seconds */
export function startHeartbeat(
  gun: GunInstance,
  roomKey: string,
  inboxId: string,
  address: string,
): void {
  stopHeartbeat()
  heartbeatTimer = setInterval(() => {
    safeWritePresence(gun, roomKey, {
      inboxId,
      address,
      ts: Date.now(),
      status: 'online',
    })
  }, HEARTBEAT_INTERVAL_MS)
}

/** Stop the heartbeat interval */
export function stopHeartbeat(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

/**
 * Join a room: write initial presence and start heartbeat.
 * Returns a cleanup function to leave cleanly.
 */
export function joinRoom(
  gun: GunInstance,
  roomKey: string,
  inboxId: string,
  address: string,
): Result<() => void, PresenceError> {
  try {
    safeWritePresence(gun, roomKey, {
      inboxId,
      address,
      ts: Date.now(),
      status: 'online',
    })
    startHeartbeat(gun, roomKey, inboxId, address)

    const cleanup = () => leaveRoom(gun, roomKey, inboxId)
    return ok(cleanup)
  } catch (error) {
    return err(
      new PresenceError(
        error instanceof Error ? error.message : String(error),
        'PRESENCE_JOIN_FAILED',
      ),
    )
  }
}

/** Leave a room: clear presence and stop heartbeat */
export function leaveRoom(
  gun: GunInstance,
  roomKey: string,
  inboxId: string,
): void {
  stopHeartbeat()
  try {
    clearPresence(gun, roomKey, inboxId)
  } catch {
    // Best-effort cleanup — swallow errors
  }
}

const PRESENCE_TTL_MS = 30_000

/** Filter presence records by TTL and map to OnlineUser[] */
export function getOnlineUsers(
  records: Map<string, GunPresenceData>,
  ttlMs: number = PRESENCE_TTL_MS,
): OnlineUser[] {
  const now = Date.now()
  const users: OnlineUser[] = []
  for (const [, record] of records) {
    if (record.ts && (now - record.ts) < ttlMs && record.status !== 'offline') {
      users.push({
        inboxId: record.inboxId,
        address: record.address,
        lastSeen: record.ts,
        isOnline: true,
      })
    }
  }
  return users.sort((a, b) => b.lastSeen - a.lastSeen)
}

/**
 * Subscribe to room presence via GunDB.
 * Collects records, filters by TTL, and calls onUpdate with OnlineUser[].
 * Returns an unsubscribe function.
 */
export function subscribeToRoomPresence(
  gun: GunInstance,
  roomKey: string,
  onUpdate: (users: OnlineUser[]) => void,
): () => void {
  const records = new Map<string, GunPresenceData>()

  const unsubscribe = subscribeToPresence(gun, roomKey, (data, inboxId) => {
    if (data) {
      records.set(inboxId, data)
    }
    onUpdate(getOnlineUsers(records))
  })

  return () => {
    unsubscribe()
    records.clear()
  }
}
