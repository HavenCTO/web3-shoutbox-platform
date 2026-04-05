import { describe, it, expect } from 'vitest'
import { applyGunNodeDiskDefaults } from './gunNodeEnv.js'

describe('applyGunNodeDiskDefaults', () => {
  it('sets RAD=false when unset and does not touch AXE/MULTICAST', () => {
    const env: NodeJS.ProcessEnv = {}
    applyGunNodeDiskDefaults(env)
    expect(env.RAD).toBe('false')
    expect(env.MULTICAST).toBeUndefined()
    expect(env.AXE).toBeUndefined()
  })

  it('sets RAD=false when RAD is empty or whitespace', () => {
    const a: NodeJS.ProcessEnv = { RAD: '' }
    applyGunNodeDiskDefaults(a)
    expect(a.RAD).toBe('false')
    const b: NodeJS.ProcessEnv = { RAD: '   ' }
    applyGunNodeDiskDefaults(b)
    expect(b.RAD).toBe('false')
  })

  it('preserves explicit RAD=true', () => {
    const env: NodeJS.ProcessEnv = { RAD: 'true' }
    applyGunNodeDiskDefaults(env)
    expect(env.RAD).toBe('true')
  })
})
