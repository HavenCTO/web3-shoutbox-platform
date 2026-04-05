import { describe, it, expect } from 'vitest'
import { applyGunNodeDiskDefaults } from './gunNodeEnv.js'

describe('applyGunNodeDiskDefaults', () => {
  it('sets RAD=true when unset and does not touch AXE/MULTICAST', () => {
    const env: NodeJS.ProcessEnv = {}
    applyGunNodeDiskDefaults(env)
    expect(env.RAD).toBe('true')
    expect(env.MULTICAST).toBeUndefined()
    expect(env.AXE).toBeUndefined()
  })

  it('sets RAD=true when RAD is empty or whitespace', () => {
    const a: NodeJS.ProcessEnv = { RAD: '' }
    applyGunNodeDiskDefaults(a)
    expect(a.RAD).toBe('true')
    const b: NodeJS.ProcessEnv = { RAD: '   ' }
    applyGunNodeDiskDefaults(b)
    expect(b.RAD).toBe('true')
  })

  it('preserves explicit RAD=true', () => {
    const env: NodeJS.ProcessEnv = { RAD: 'true' }
    applyGunNodeDiskDefaults(env)
    expect(env.RAD).toBe('true')
  })

  it('preserves explicit RAD=false', () => {
    const env: NodeJS.ProcessEnv = { RAD: 'false' }
    applyGunNodeDiskDefaults(env)
    expect(env.RAD).toBe('false')
  })
})
