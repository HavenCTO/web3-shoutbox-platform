import { describe, it, expect } from 'vitest'
import {
  getOrCreateEphemeralIdentity,
  clearEphemeralIdentity,
  EPHEMERAL_KEY_STORAGE_KEY,
} from '@/lib/ephemeral-identity'
import { deriveDisplayName } from '@/lib/display-name'

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) },
    map,
  }
}

describe('getOrCreateEphemeralIdentity', () => {
  it('creates and persists a valid identity on first call', () => {
    const storage = fakeStorage()
    const id = getOrCreateEphemeralIdentity(storage as never)
    expect(id.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(id.privateKey).toMatch(/^0x[0-9a-fA-F]{64}$/)
    expect(storage.map.get(EPHEMERAL_KEY_STORAGE_KEY)).toBe(id.privateKey)
  })

  it('reuses the same identity on later calls (stable across visits)', () => {
    const storage = fakeStorage()
    const first = getOrCreateEphemeralIdentity(storage as never)
    const second = getOrCreateEphemeralIdentity(storage as never)
    expect(second.address).toBe(first.address)
    expect(second.privateKey).toBe(first.privateKey)
  })

  it('signs a message without any external wallet', async () => {
    const storage = fakeStorage()
    const id = getOrCreateEphemeralIdentity(storage as never)
    const sig = await id.account.signMessage({ message: 'hello' })
    expect(sig).toMatch(/^0x[0-9a-fA-F]{130}$/)
  })

  it('regenerates when the stored key is corrupt', () => {
    const storage = fakeStorage({ [EPHEMERAL_KEY_STORAGE_KEY]: 'not-a-key' })
    const id = getOrCreateEphemeralIdentity(storage as never)
    expect(id.privateKey).toMatch(/^0x[0-9a-fA-F]{64}$/)
    expect(storage.map.get(EPHEMERAL_KEY_STORAGE_KEY)).toBe(id.privateKey)
  })

  it('clear removes the stored key so a fresh identity is made next time', () => {
    const storage = fakeStorage()
    const first = getOrCreateEphemeralIdentity(storage as never)
    clearEphemeralIdentity(storage as never)
    const second = getOrCreateEphemeralIdentity(storage as never)
    expect(second.address).not.toBe(first.address)
  })
})

describe('deriveDisplayName', () => {
  it('is deterministic for the same address', () => {
    const a = '0x1234567890abcdef1234567890abcdef12345678'
    expect(deriveDisplayName(a)).toBe(deriveDisplayName(a.toUpperCase().replace('0X', '0x')))
  })

  it('never reveals the raw address and looks like a friendly name', () => {
    const a = '0x1234567890abcdef1234567890abcdef12345678'
    const name = deriveDisplayName(a)
    expect(name).not.toContain('0x')
    expect(name.split(' ')).toHaveLength(2)
  })

  it('gives different names for different addresses', () => {
    expect(deriveDisplayName('0x0000000000000000000000000000000000000001'))
      .not.toBe(deriveDisplayName('0x0000000000000000000000000000000000000002'))
  })
})
