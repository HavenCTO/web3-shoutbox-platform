import type { PresenceSyncStatus } from '@/types/presenceSync'

/** Shape passed to Gun `put` ack callbacks (browser relay). */
export interface GunPutAck {
  err?: string | unknown
  lack?: boolean
}

function ackIndicatesFailure(ack: GunPutAck): boolean {
  return Boolean(ack.err)
}

/**
 * Maps a presence `put` ack to sync status. Any error marks degraded; success marks synced.
 */
export function nextPresenceSyncStatusFromAck(ack: GunPutAck): PresenceSyncStatus {
  if (ackIndicatesFailure(ack)) {
    return 'degraded'
  }
  return 'synced'
}
