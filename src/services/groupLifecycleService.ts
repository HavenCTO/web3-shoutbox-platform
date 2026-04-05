/**
 * Group Lifecycle Service — orchestration layer for group window management.
 * Handles creation (leader), discovery (non-leader), and failover flows.
 */

import type { GunInstance } from 'gun'
import type { Group } from '@xmtp/browser-sdk'
import type { GroupWindow } from '@/types/group'
import type { OnlineUser } from '@/types/presence'
import type { XmtpClient } from '@/lib/xmtp'
import { GroupLifecycleError } from '@/types/errors'
import type { Result } from '@/types/result'
import { ok, err } from '@/types/result'
import { readCurrentGroup, writeGroupToGunDB, subscribeToGroup } from '@/lib/group-lifecycle'
import { createGroup, addMembersToGroup } from '@/services/messagingService'

export interface EnsureOnlineUsersInGroupResult {
  /** Ethereum addresses passed to `addMembersByIdentifiers` for peers not yet on the MLS roster. */
  addedAddresses: string[]
}

/** Check if a group window has expired. */
export function isGroupExpired(groupWindow: GroupWindow): boolean {
  return Date.now() > groupWindow.expiresAt
}

/** Returns the next epoch number. */
export function calculateNextEpoch(currentEpoch: number): number {
  return currentEpoch + 1
}

/** Read the current group from GunDB and check validity. */
export async function getCurrentGroupForRoom(
  gun: GunInstance,
  roomKey: string,
): Promise<Result<GroupWindow | null, GroupLifecycleError>> {
  try {
    const group = await readCurrentGroup(gun, roomKey)
    if (!group) return ok(null)
    if (isGroupExpired(group)) return ok(null)
    return ok(group)
  } catch (e) {
    return err(
      new GroupLifecycleError(
        `Failed to read group for room ${roomKey}: ${e instanceof Error ? e.message : String(e)}`,
        'READ_FAILED',
      ),
    )
  }
}

/** Write a new group window to GunDB. */
export async function registerNewGroup(
  gun: GunInstance,
  roomKey: string,
  groupId: string,
  epoch: number,
  createdBy: string,
  windowMinutes: number,
): Promise<Result<GroupWindow, GroupLifecycleError>> {
  try {
    const now = Date.now()
    const groupWindow: GroupWindow = {
      groupId,
      epoch,
      createdBy,
      createdAt: now,
      expiresAt: now + windowMinutes * 60_000,
      windowMinutes,
    }
    writeGroupToGunDB(gun, roomKey, groupWindow)
    return ok(groupWindow)
  } catch (e) {
    return err(
      new GroupLifecycleError(
        `Failed to register group for room ${roomKey}: ${e instanceof Error ? e.message : String(e)}`,
        'WRITE_FAILED',
      ),
    )
  }
}

/**
 * Leader creates an XMTP group with all online users and registers it in GunDB.
 * Race-condition safe: if a group already appeared in GunDB while we were creating,
 * we detect it and return the existing one instead.
 */
export async function createGroupAsLeader(
  xmtpClient: XmtpClient,
  gun: GunInstance,
  roomKey: string,
  onlineUsers: OnlineUser[],
  epoch: number,
  windowMinutes: number,
): Promise<Result<GroupWindow, GroupLifecycleError>> {
  try {
    // Race check: another leader may have written first
    const existing = await readCurrentGroup(gun, roomKey)
    if (existing && !isGroupExpired(existing)) {
      return ok(existing)
    }

    const addresses = onlineUsers
      .filter((u) => u.isOnline)
      .map((u) => u.address)

    const groupResult = await createGroup(xmtpClient, addresses)
    if (!groupResult.ok) {
      return err(new GroupLifecycleError(groupResult.error.message, 'CREATE_FAILED'))
    }

    const group = groupResult.data
    const inboxId = xmtpClient.inboxId ?? 'unknown'

    // Race check again before writing
    const raceCheck = await readCurrentGroup(gun, roomKey)
    if (raceCheck && !isGroupExpired(raceCheck)) {
      return ok(raceCheck)
    }

    return registerNewGroup(gun, roomKey, group.id, epoch, inboxId, windowMinutes)
  } catch (e) {
    return err(
      new GroupLifecycleError(
        `Leader group creation failed: ${e instanceof Error ? e.message : String(e)}`,
        'CREATE_FAILED',
      ),
    )
  }
}

/**
 * Non-leader discovers the current group from GunDB and joins it if needed.
 * Returns the GroupWindow and the XMTP Group conversation object.
 */
export async function discoverAndJoinGroup(
  xmtpClient: XmtpClient,
  gun: GunInstance,
  roomKey: string,
): Promise<Result<{ groupWindow: GroupWindow; group: Group }, GroupLifecycleError>> {
  try {
    const groupWindow = await readCurrentGroup(gun, roomKey)
    if (!groupWindow || isGroupExpired(groupWindow)) {
      return err(new GroupLifecycleError('No valid group found', 'NO_GROUP'))
    }

    // Sync conversations so we can find the group
    await xmtpClient.conversations.sync()

    const conversation = await xmtpClient.conversations.getConversationById(
      groupWindow.groupId,
    )

    if (conversation) {
      // Already a member
      return ok({ groupWindow, group: conversation as Group })
    }

    // Not a member yet — the leader should have added us, but we may need to sync again
    // Try adding ourselves via the leader's group reference
    // Since we can't add ourselves, we rely on the leader having added us at creation.
    // If we still can't find it after sync, return error so the hook can retry.
    return err(
      new GroupLifecycleError(
        'Group exists but not yet accessible — may still be syncing',
        'NOT_MEMBER_YET',
      ),
    )
  } catch (e) {
    return err(
      new GroupLifecycleError(
        `Discovery failed: ${e instanceof Error ? e.message : String(e)}`,
        'DISCOVER_FAILED',
      ),
    )
  }
}

/**
 * Waits for a group to appear in GunDB within timeoutMs.
 * Used for leader failover — if the elected leader doesn't create a group in time,
 * the next client takes over.
 */
export function waitForGroup(
  gun: GunInstance,
  roomKey: string,
  timeoutMs: number = 15_000,
): Promise<GroupWindow | null> {
  return new Promise((resolve) => {
    let resolved = false
    const unsub = subscribeToGroup(gun, roomKey, (data) => {
      if (resolved) return
      if (data && !isGroupExpired(data)) {
        resolved = true
        clearTimeout(timer)
        unsub()
        resolve(data)
      }
    })

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        unsub()
        resolve(null)
      }
    }, timeoutMs)
  })
}

/**
 * Leader failover: wait for a group, and if none appears, the caller
 * should re-evaluate leadership and potentially create the group.
 */
export async function handleLeaderFailover(
  xmtpClient: XmtpClient,
  gun: GunInstance,
  roomKey: string,
  onlineUsers: OnlineUser[],
  currentEpoch: number,
  windowMinutes: number,
  timeoutMs: number = 15_000,
): Promise<Result<GroupWindow, GroupLifecycleError>> {
  const appeared = await waitForGroup(gun, roomKey, timeoutMs)
  if (appeared) {
    return ok(appeared)
  }

  // No group appeared — this client takes over as leader
  return createGroupAsLeader(
    xmtpClient,
    gun,
    roomKey,
    onlineUsers,
    currentEpoch,
    windowMinutes,
  )
}
