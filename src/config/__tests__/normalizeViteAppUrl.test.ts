import { describe, it, expect } from 'vitest'
import { normalizeViteAppUrl } from '../normalizeViteAppUrl'

describe('normalizeViteAppUrl', () => {
  it('returns empty string for empty or whitespace-only input', () => {
    expect(normalizeViteAppUrl('')).toBe('')
    expect(normalizeViteAppUrl('   ')).toBe('')
  })

  it('leaves full http(s) URLs unchanged', () => {
    expect(normalizeViteAppUrl('https://shoutbox.orbiter.website')).toBe(
      'https://shoutbox.orbiter.website',
    )
    expect(normalizeViteAppUrl('http://localhost:3000')).toBe('http://localhost:3000')
  })

  it('prepends https:// to bare hostnames', () => {
    expect(normalizeViteAppUrl('shoutbox.orbiter.website')).toBe(
      'https://shoutbox.orbiter.website',
    )
    expect(normalizeViteAppUrl('  example.com  ')).toBe('https://example.com')
  })

  it('prepends http:// for localhost and 127.0.0.1 without a scheme', () => {
    expect(normalizeViteAppUrl('localhost:3000')).toBe('http://localhost:3000')
    expect(normalizeViteAppUrl('127.0.0.1:5173')).toBe('http://127.0.0.1:5173')
  })
})
