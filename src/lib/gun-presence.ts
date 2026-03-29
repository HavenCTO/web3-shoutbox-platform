/**
 * Low-level GunDB presence operations.
 *
 * Writes/clears a user's presence record at:
 *   shoutbox-v1/presence/{roomKey}/{inboxId}
 */

import type { GunInstance } from 'gun'
import { GUN_NAMESPACE } from '@/lib/gun'

export interface GunPresenceData {
  inboxId: string
  address: string
  ts: number
  status: 'online' | 'offline'
}

function presenceRef(gun: GunInstance, roomKey: string, inboxId: string): GunInstance {
  return gun.get(GUN_NAMESPACE).get('presence').get(roomKey).get(inboxId)
}

/** Write a presence record to GunDB */
export function writePresence(
  gun: GunInstance,
  roomKey: string,
  record: GunPresenceData,
): void {
  presenceRef(gun, roomKey, record.inboxId).put(record)
}

/** Clear presence by setting timestamp to 0 and status to offline */
export function clearPresence(
  gun: GunInstance,
  roomKey: string,
  inboxId: string,
): void {
  presenceRef(gun, roomKey, inboxId).put({ ts: 0, status: 'offline' })
}

/**
 * Subscribe to all presence records for a room.
 * Calls `callback` whenever any user's presence changes.
 * Returns an unsubscribe function.
 */
export function subscribeToPresence(
  gun: GunInstance,
  roomKey: string,
  callback: (data: GunPresenceData | null, inboxId: string) => void,
): () => void {
  const ref = gun.get(GUN_NAMESPACE).get('presence').get(roomKey)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = ref.map().on((data: any, key: string) => {
    if (!data || !key) return
    callback(data as GunPresenceData, key)
  })

  return () => {
    // GunDB .off() to unsubscribe
    try {
      ;(handler as unknown as GunInstance).off()
    } catch {
      // Best-effort cleanup
    }
  }
}
