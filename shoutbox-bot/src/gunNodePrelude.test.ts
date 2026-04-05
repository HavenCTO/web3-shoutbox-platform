import { describe, it, expect, afterEach, vi } from 'vitest'

describe('gunNodePrelude', () => {
  afterEach(() => {
    vi.resetModules()
    delete process.env.RAD
  })

  it('runs applyGunNodeDiskDefaults on import', async () => {
    delete process.env.RAD
    await import('./gunNodePrelude.js')
    expect(process.env.RAD).toBe('true')
  })
})
