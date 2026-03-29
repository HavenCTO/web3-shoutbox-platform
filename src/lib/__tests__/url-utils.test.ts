import { describe, it, expect } from 'vitest'
import { normalizeUrl, hashUrl } from '@/lib/url-utils'

describe('normalizeUrl', () => {
  it('strips query params and hash fragments', () => {
    expect(normalizeUrl('https://example.com/blog/post-1?utm=twitter#comments'))
      .toBe('https://example.com/blog/post-1')
  })

  it('lowercases the host', () => {
    expect(normalizeUrl('https://Example.COM/path'))
      .toBe('https://example.com/path')
  })

  it('removes trailing slash', () => {
    expect(normalizeUrl('https://example.com/path/'))
      .toBe('https://example.com/path')
  })

  it('handles root path', () => {
    expect(normalizeUrl('https://example.com/'))
      .toBe('https://example.com')
  })
})

describe('hashUrl', () => {
  it('produces consistent hash for same normalized URL', async () => {
    const a = await hashUrl('https://example.com/page?a=1')
    const b = await hashUrl('https://example.com/page?b=2')
    expect(a).toBe(b)
  })

  it('produces different hashes for different URLs', async () => {
    const a = await hashUrl('https://example.com/page-1')
    const b = await hashUrl('https://example.com/page-2')
    expect(a).not.toBe(b)
  })

  it('returns a 64-char hex string', async () => {
    const hash = await hashUrl('https://example.com')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('same URL with different fragments produces same hash', async () => {
    const a = await hashUrl('https://example.com/post#top')
    const b = await hashUrl('https://example.com/post#bottom')
    expect(a).toBe(b)
  })
})
