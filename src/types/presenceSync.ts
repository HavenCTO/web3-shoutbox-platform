/**
 * Gun relay sync for presence writes. Used to gate leader election — local-only
 * graphs look like "only me online" when the relay is unreachable.
 */
export type PresenceSyncStatus = 'unknown' | 'synced' | 'degraded'
