import { create } from 'zustand'
import { nextPresenceSyncStatusFromAck } from '@/lib/gunPresenceRelayHealth'
import type { GunPutAck } from '@/lib/gunPresenceRelayHealth'
import type { PresenceSyncStatus } from '@/types/presenceSync'

interface GunPresenceSyncState {
  syncStatus: PresenceSyncStatus
  recordPresencePutAck: (ack: GunPutAck) => void
  resetPresenceSync: () => void
}

export const useGunPresenceSyncStore = create<GunPresenceSyncState>((set) => ({
  syncStatus: 'unknown',
  recordPresencePutAck: (ack: GunPutAck) => {
    set({ syncStatus: nextPresenceSyncStatusFromAck(ack) })
  },
  resetPresenceSync: () => set({ syncStatus: 'unknown' }),
}))

/** For non-React modules (e.g. gun-presence) without subscribing. */
export function recordPresencePutAck(ack: GunPutAck): void {
  useGunPresenceSyncStore.getState().recordPresencePutAck(ack)
}

export function resetPresenceSyncHealth(): void {
  useGunPresenceSyncStore.getState().resetPresenceSync()
}
