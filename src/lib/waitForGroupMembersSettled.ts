import type { Group } from '@xmtp/browser-sdk'
import { MEMBER_SETTLE_MAX_WAIT_MS } from '@/hooks/xmtpConversationConstants'
import { sleep } from '@/lib/waitForGroupConversation'

export interface WaitForGroupMembersSettledOptions {
  maxAttempts: number
  pollIntervalMs: number
  requiredConsecutiveStable: number
  /** Avoid treating the creator-only snapshot as final before add-member commits land. */
  minTotalWaitMs: number
  /** Stop polling after this duration even if `maxAttempts` is not reached. */
  maxTotalWaitMs: number
  /**
   * After this many ms, accept a stable roster even when some required inboxes
   * are missing (e.g. a bot whose address couldn't be added to the MLS group).
   * The roster must still have ≥ 2 members and be consecutively stable.
   * Set to `Infinity` to disable this fallback.
   */
  stableRosterFallbackMs: number
}

export const DEFAULT_WAIT_MEMBERS_SETTLED_OPTIONS: WaitForGroupMembersSettledOptions = {
  maxAttempts: 56,
  pollIntervalMs: 500,
  requiredConsecutiveStable: 2,
  minTotalWaitMs: 1200,
  maxTotalWaitMs: MEMBER_SETTLE_MAX_WAIT_MS,
  stableRosterFallbackMs: 8_000,
}

export type WaitForGroupMembersSettledResult =
  | { ok: true }
  | { ok: false; reason: 'cancelled' | 'timeout' | 'sync_error' }

function fingerprintMemberInboxes(members: ReadonlyArray<{ inboxId: string }>): string {
  const ids = [...new Set(members.map((m) => m.inboxId).filter(Boolean))]
  return ids.sort().join('\0')
}

function normalizeRequiredInboxIds(getRequired: () => readonly string[]): string[] {
  const raw = getRequired()
  return [...new Set(raw.map((id) => id.trim()).filter(Boolean))].sort()
}

function logDevRosterPresenceMismatch(params: {
  requiredInboxCount: number
  uniqueMemberInboxCount: number
}): void {
  if (!import.meta.env.DEV) return
  console.debug(
    '[waitForGroupMembersSettled] roster vs presence (last attempt before fail)',
    params,
  )
}

/**
 * Minimum number of MLS members required for the stable-roster fallback to
 * accept a roster that is missing some presence users.  A roster with only the
 * creator (1 member) is never accepted early — at least one other peer must
 * have been added.
 */
const STABLE_FALLBACK_MIN_MEMBERS = 2

/**
 * Blocks until MLS membership includes every required inbox (typically all users
 * currently online in the room) and the member set stops changing across syncs.
 * Otherwise early sends encrypt for an incomplete epoch and peers never decrypt until they refresh.
 *
 * **Stable-roster fallback:** if some required inboxes never appear (e.g. a bot
 * whose Ethereum address couldn't be resolved to an XMTP identity), the function
 * will still succeed once the roster has been stable for `requiredConsecutiveStable`
 * polls, has ≥ 2 members, and `stableRosterFallbackMs` has elapsed.  This prevents
 * unreachable presence entries from blocking chat for all human users.
 */
export async function waitForGroupMembersSettled(
  group: Pick<Group, 'sync' | 'members'>,
  getRequiredInboxIds: () => readonly string[],
  shouldCancel: () => boolean,
  options: WaitForGroupMembersSettledOptions,
): Promise<WaitForGroupMembersSettledResult> {
  const start = Date.now()
  let prevFingerprint: string | null = null
  let consecutiveStable = 0
  /** Tracks roster stability independently — even when not all required inboxes are present. */
  let prevFingerprintAny: string | null = null
  let consecutiveStableAny = 0
  let lastRequiredInboxCount = 0
  let lastUniqueMemberInboxCount = 0

  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    if (shouldCancel()) return { ok: false, reason: 'cancelled' }

    try {
      await group.sync()
      const members = await group.members()
      const fp = fingerprintMemberInboxes(members)
      const inboxSet = new Set(
        members.map((m) => m.inboxId).filter(Boolean) as string[],
      )

      const requiredSorted = normalizeRequiredInboxIds(getRequiredInboxIds)
      lastRequiredInboxCount = requiredSorted.length
      lastUniqueMemberInboxCount = inboxSet.size
      const minInboxes = Math.max(1, requiredSorted.length)
      const allRequiredPresent =
        requiredSorted.length === 0
          ? inboxSet.size >= 1
          : requiredSorted.every((id) => inboxSet.has(id)) && inboxSet.size >= minInboxes

      // ── Primary path: all required inboxes present + stable ──
      if (!allRequiredPresent || fp.length === 0) {
        prevFingerprint = null
        consecutiveStable = 0
      } else if (fp === prevFingerprint) {
        consecutiveStable += 1
        if (consecutiveStable >= options.requiredConsecutiveStable) {
          const elapsedOk = Date.now() - start >= options.minTotalWaitMs
          if (elapsedOk) return { ok: true }
        }
      } else {
        prevFingerprint = fp
        consecutiveStable = 1
      }

      // ── Fallback path: roster stable but some required inboxes missing ──
      // Tracks stability regardless of whether all required inboxes are present.
      if (fp.length === 0) {
        prevFingerprintAny = null
        consecutiveStableAny = 0
      } else if (fp === prevFingerprintAny) {
        consecutiveStableAny += 1
      } else {
        prevFingerprintAny = fp
        consecutiveStableAny = 1
      }

      if (
        !allRequiredPresent &&
        consecutiveStableAny >= options.requiredConsecutiveStable &&
        inboxSet.size >= STABLE_FALLBACK_MIN_MEMBERS
      ) {
        const elapsed = Date.now() - start
        if (elapsed >= options.stableRosterFallbackMs) {
          if (import.meta.env.DEV) {
            console.debug(
              '[waitForGroupMembersSettled] stable-roster fallback: accepting roster with %d/%d required inboxes after %dms',
              inboxSet.size,
              requiredSorted.length,
              elapsed,
            )
          }
          return { ok: true }
        }
      }
    } catch {
      return { ok: false, reason: 'sync_error' }
    }

    if (shouldCancel()) return { ok: false, reason: 'cancelled' }

    const elapsed = Date.now() - start
    if (elapsed >= options.maxTotalWaitMs) {
      logDevRosterPresenceMismatch({
        requiredInboxCount: lastRequiredInboxCount,
        uniqueMemberInboxCount: lastUniqueMemberInboxCount,
      })
      return { ok: false, reason: 'timeout' }
    }

    if (attempt < options.maxAttempts - 1) {
      await sleep(options.pollIntervalMs)
    }
    if (shouldCancel()) return { ok: false, reason: 'cancelled' }
  }

  logDevRosterPresenceMismatch({
    requiredInboxCount: lastRequiredInboxCount,
    uniqueMemberInboxCount: lastUniqueMemberInboxCount,
  })
  return { ok: false, reason: 'timeout' }
}
