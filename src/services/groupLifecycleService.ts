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

// ── Deferred creation gate ──────────────────────────────────────────────────

/**
 * Minimum number of distinct online inbox IDs required before the leader
 * creates an MLS group.  A value of 2 means a solo user never triggers
 * MLS setup — creation is deferred until at least one *other* participant
 * is stably present.
 */
export const MIN_PARTICIPANTS = 2

/**
 * How long (ms) the multi-participant condition must hold before
 * createGroupAsLeader is allowed.  Prevents flicker: if someone appears
 * for one heartbeat cycle and vanishes, we don't spin up MLS.
 *
 * Intentionally > HEARTBEAT_INTERVAL_MS (10 s) so the condition must span
 * at least two heartbeat ticks.
 */
export const CREATION_GATE_DEBOUNCE_MS = 12_000

/**
 * Determines whether MLS group creation should still be deferred.
 *
 * Pure function — safe to call every render / presence tick.
 *
 * @param onlineUsers  Current presence list.
 * @param selfInboxId  The local user's inbox ID (may be null during init).
 * @param hasExistingGroup  True if the room/epoch already has an active groupId.
 * @returns `true` when creation should **wait** (i.e. not enough participants).
 */
export function shouldDeferGroupCreation(
  onlineUsers: OnlineUser[],
  selfInboxId: string | null,
  hasExistingGroup: boolean,
): boolean {
  // Latch: once a group exists for this epoch, never revert to deferred.
  if (hasExistingGroup) return false

  const distinctOnline = new Set(
    onlineUsers.filter((u) => u.isOnline).map((u) => u.inboxId),
  )
  return distinctOnline.size < MIN_PARTICIPANTS
}

/**
 * Returns the count of distinct online inbox IDs.
 * Useful for UI ("Waiting for others — 1 of 2 needed") and for logging.
 */
export function countDistinctOnlineInboxes(onlineUsers: OnlineUser[]): number {
  return new Set(onlineUsers.filter((u) => u.isOnline).map((u) => u.inboxId)).size
}

// ── Group window helpers ────────────────────────────────────────────────────

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

/** Deterministic tiebreaker for same-epoch conflicts: lowest groupId wins. */
export function resolveGroupConflict(
  a: GroupWindow,
  b: GroupWindow,
): GroupWindow {
  if (a.epoch !== b.epoch) return a.epoch > b.epoch ? a : b
  return a.groupId <= b.groupId ? a : b
}

/** Short delay to let competing GunDB writes propagate before the final race check. */
const RACE_SETTLE_MS = 1_500

/**
 * Leader creates an XMTP group with all online users and registers it in GunDB.
 *
 * Race-condition safe: after creating the XMTP group we wait a short settle
 * period, then re-read GunDB. If a competing group appeared at the **same
 * epoch**, the lowest `groupId` wins deterministically so both clients converge
 * on the same group without coordination.
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
      // If an existing group is at a higher epoch, defer immediately.
      // Same-epoch conflicts are handled below after we create our own group.
      if (existing.epoch > epoch) return ok(existing)
      // If existing is at the target epoch, no need to create a new group.
      if (existing.epoch === epoch) return ok(existing)
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

    // Write our candidate group immediately so competing clients see it
    const ourWindow = await registerNewGroup(gun, roomKey, group.id, epoch, inboxId, windowMinutes)
    if (!ourWindow.ok) return ourWindow

    // Settle: give competing writes time to propagate via Gun relays
    await new Promise((r) => setTimeout(r, RACE_SETTLE_MS))

    // Final race check — if another group appeared at the same epoch, tiebreak
    const raceCheck = await readCurrentGroup(gun, roomKey)
    if (raceCheck && !isGroupExpired(raceCheck)) {
      const winner = resolveGroupConflict(ourWindow.data, raceCheck)
      if (winner.groupId !== ourWindow.data.groupId) {
        // Another group won — re-write GunDB so all peers converge
        writeGroupToGunDB(gun, roomKey, winner)
        return ok(winner)
      }
      // We won (or tied) — ensure GunDB has our record
      if (raceCheck.groupId !== ourWindow.data.groupId) {
        writeGroupToGunDB(gun, roomKey, ourWindow.data)
      }
    }

    return ourWindow
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
