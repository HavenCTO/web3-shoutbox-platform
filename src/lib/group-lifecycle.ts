/**
 * GunDB group ID storage operations.
 *
 * Reads, writes, and subscribes to the XMTP group metadata stored at:
 *   shoutbox-v1/groups/{roomKey}
 */

import type { GunInstance } from 'gun'
import type { GroupWindow } from '@/types/group'
import { GUN_NAMESPACE } from '@/lib/gun'

function groupRef(gun: GunInstance, roomKey: string): GunInstance {
  return gun.get(GUN_NAMESPACE).get('groups').get(roomKey)
}

/** Write a group window entry to GunDB. */
export function writeGroupToGunDB(
  gun: GunInstance,
  roomKey: string,
  groupWindow: GroupWindow,
): void {
  groupRef(gun, roomKey).put(groupWindow)
}

/** Subscribe to group changes for a room. Returns an unsubscribe function. */
export function subscribeToGroup(
  gun: GunInstance,
  roomKey: string,
  callback: (data: GroupWindow | null) => void,
): () => void {
  const ref = groupRef(gun, roomKey)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ref.on((data: any) => {
    if (!data || !data.groupId) {
      callback(null)
      return
    }
    callback({
      groupId: data.groupId,
      epoch: data.epoch,
      createdBy: data.createdBy,
      createdAt: data.createdAt,
      expiresAt: data.expiresAt,
      windowMinutes: data.windowMinutes,
    })
  })

  return () => {
    try {
      ;(ref as unknown as GunInstance).off()
    } catch {
      // Best-effort cleanup
    }
  }
}

/** One-time read of the current group entry. Returns null if none exists. */
export function readCurrentGroup(
  gun: GunInstance,
  roomKey: string,
): Promise<GroupWindow | null> {
  return new Promise((resolve) => {
    groupRef(gun, roomKey).once(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data: any) => {
        if (!data || !data.groupId) {
          resolve(null)
          return
        }
        resolve({
          groupId: data.groupId,
          epoch: data.epoch,
          createdBy: data.createdBy,
          createdAt: data.createdAt,
          expiresAt: data.expiresAt,
          windowMinutes: data.windowMinutes,
        })
      },
    )
  })
}
