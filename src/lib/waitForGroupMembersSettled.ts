import type { Group } from '@xmtp/browser-sdk'
import { sleep } from '@/lib/waitForGroupConversation'

export interface WaitForGroupMembersSettledOptions {
  maxAttempts: number
  pollIntervalMs: number
  requiredConsecutiveStable: number
  /** Avoid treating the creator-only snapshot as final before add-member commits land. */
  minTotalWaitMs: number
}

export const DEFAULT_WAIT_MEMBERS_SETTLED_OPTIONS: WaitForGroupMembersSettledOptions = {
  maxAttempts: 56,
  pollIntervalMs: 500,
  requiredConsecutiveStable: 2,
  minTotalWaitMs: 1200,
}

function fingerprintMemberInboxes(members: ReadonlyArray<{ inboxId: string }>): string {
  const ids = [...new Set(members.map((m) => m.inboxId).filter(Boolean))]
  return ids.sort().join('\0')
}

function normalizeRequiredInboxIds(getRequired: () => readonly string[]): string[] {
  const raw = getRequired()
  return [...new Set(raw.map((id) => id.trim()).filter(Boolean))].sort()
}

/**
 * Blocks until MLS membership includes every required inbox (typically all users
 * currently online in the room) and the member set stops changing across syncs.
 * Otherwise early sends encrypt for an incomplete epoch and peers never decrypt until they refresh.
 */
export async function waitForGroupMembersSettled(
  group: Pick<Group, 'sync' | 'members'>,
  getRequiredInboxIds: () => readonly string[],
  shouldCancel: () => boolean,
  options: WaitForGroupMembersSettledOptions,
): Promise<boolean> {
  const start = Date.now()
  let prevFingerprint: string | null = null
  let consecutiveStable = 0

  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    if (shouldCancel()) return false

    try {
      await group.sync()
      const members = await group.members()
      const fp = fingerprintMemberInboxes(members)
      const inboxSet = new Set(
        members.map((m) => m.inboxId).filter(Boolean) as string[],
      )

      const requiredSorted = normalizeRequiredInboxIds(getRequiredInboxIds)
      const minInboxes = Math.max(1, requiredSorted.length)
      const allRequiredPresent =
        requiredSorted.length === 0
          ? inboxSet.size >= 1
          : requiredSorted.every((id) => inboxSet.has(id)) && inboxSet.size >= minInboxes

      if (!allRequiredPresent || fp.length === 0) {
        prevFingerprint = null
        consecutiveStable = 0
      } else if (fp === prevFingerprint) {
        consecutiveStable += 1
        if (consecutiveStable >= options.requiredConsecutiveStable) {
          const elapsedOk = Date.now() - start >= options.minTotalWaitMs
          if (elapsedOk) return true
        }
      } else {
        prevFingerprint = fp
        consecutiveStable = 1
      }
    } catch {
      return false
    }

    if (attempt < options.maxAttempts - 1) {
      await sleep(options.pollIntervalMs)
    }
    if (shouldCancel()) return false
  }

  return false
}
