import { describe, it, expect } from 'vitest'
import { hashUrl, normalizeUrl } from './roomKey.js'

describe('normalizeUrl', () => {
  it('lowercases host and strips query, hash, and trailing path slashes', () => {
    expect(normalizeUrl('https://Example.com/path/?x=1#h')).toBe('https://example.com/path')
  })

  it('normalizes root path to empty path segment', () => {
    expect(normalizeUrl('https://shoutbox.orbiter.website/')).toBe(
      'https://shoutbox.orbiter.website',
    )
  })
})

describe('hashUrl', () => {
  it('produces a 64-character hex digest', async () => {
    const h = await hashUrl('https://example.com/a')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('matches for URLs that normalize identically', async () => {
    const a = await hashUrl('https://shoutbox.orbiter.website/')
    const b = await hashUrl('https://shoutbox.orbiter.website')
    expect(a).toBe(b)
  })
})
