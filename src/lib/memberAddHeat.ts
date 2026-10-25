/**
 * Heat limit for leader member-adds. Each add is an MLS operation on the
 * leader (and XMTP rate limits are real), so identity-cycling attackers
 * must not be able to force unbounded adds. Heat = successful-or-attempted
 * adds inside a sliding window; over budget, adds cool down until the
 * oldest attempts age out.
 */
export interface MemberAddHeatLimits {
  windowMs: number
  maxAdds: number
  minIntervalMs: number
}

export const MEMBER_ADD_HEAT_LIMITS: MemberAddHeatLimits = {
  windowMs: 10 * 60_000,
  maxAdds: 20,
  minIntervalMs: 5_000,
}

/** Drop timestamps outside the heat window. */
export function pruneAddTimestamps(
  timestamps: readonly number[],
  now: number,
  limits: MemberAddHeatLimits = MEMBER_ADD_HEAT_LIMITS,
): number[] {
  return timestamps.filter((t) => now - t < limits.windowMs)
}

/**
 * Whether a batch of `batchSize` adds may proceed at `now`, given the
 * pruned attempt timestamps (one entry per added address).
 */
export function addBatchAllowed(
  prunedTimestamps: readonly number[],
  batchSize: number,
  now: number,
  limits: MemberAddHeatLimits = MEMBER_ADD_HEAT_LIMITS,
): boolean {
  if (batchSize <= 0) return false
  if (prunedTimestamps.length + batchSize > limits.maxAdds) return false
  const last = prunedTimestamps[prunedTimestamps.length - 1]
  if (last !== undefined && now - last < limits.minIntervalMs) return false
  return true
}
