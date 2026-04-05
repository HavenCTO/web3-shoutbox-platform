import { describe, it, expect } from 'vitest'
import { GUN_NAMESPACE } from '@/lib/gunNamespace'

describe('GUN_NAMESPACE', () => {
  it('matches the Shoutbox Gun graph root', () => {
    expect(GUN_NAMESPACE).toBe('shoutbox-v1')
  })
})
