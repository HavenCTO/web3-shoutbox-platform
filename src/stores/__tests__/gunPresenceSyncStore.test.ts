import { describe, it, expect, beforeEach } from 'vitest'
import {
  useGunPresenceSyncStore,
  recordPresencePutAck,
  resetPresenceSyncHealth,
} from '@/stores/gunPresenceSyncStore'

describe('gunPresenceSyncStore', () => {
  beforeEach(() => {
    useGunPresenceSyncStore.setState({ syncStatus: 'unknown' })
  })

  it('starts as unknown', () => {
    useGunPresenceSyncStore.setState({ syncStatus: 'unknown' })
    expect(useGunPresenceSyncStore.getState().syncStatus).toBe('unknown')
  })

  it('recordPresencePutAck sets synced on success', () => {
    useGunPresenceSyncStore.getState().recordPresencePutAck({})
    expect(useGunPresenceSyncStore.getState().syncStatus).toBe('synced')
  })

  it('recordPresencePutAck sets degraded on error', () => {
    useGunPresenceSyncStore.getState().recordPresencePutAck({ err: 'fail' })
    expect(useGunPresenceSyncStore.getState().syncStatus).toBe('degraded')
  })

  it('resetPresenceSyncHealth restores unknown', () => {
    useGunPresenceSyncStore.getState().recordPresencePutAck({})
    expect(useGunPresenceSyncStore.getState().syncStatus).toBe('synced')
    resetPresenceSyncHealth()
    expect(useGunPresenceSyncStore.getState().syncStatus).toBe('unknown')
  })

  it('recordPresencePutAck export updates the store', () => {
    recordPresencePutAck({ err: 'x' })
    expect(useGunPresenceSyncStore.getState().syncStatus).toBe('degraded')
  })
})
