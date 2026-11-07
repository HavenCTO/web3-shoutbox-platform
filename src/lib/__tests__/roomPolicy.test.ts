import { describe, it, expect, vi, afterEach } from 'vitest'
import { ALLOWED_ROOMS, DEFAULT_ROOM, isRoomAllowed, resolveRoom, roomLabel } from '@/lib/roomPolicy'

const DEFAULT = 'https://shoutbox.pinme.dev/default'

describe('room policy (default single-room deployment)', () => {
  it('serves exactly the configured room', () => {
    expect(ALLOWED_ROOMS).toEqual([DEFAULT])
    expect(DEFAULT_ROOM).toBe(DEFAULT)
  })

  it('accepts the allowed room in any spelling normalizeUrl folds together', () => {
    expect(isRoomAllowed(DEFAULT)).toBe(true)
    expect(isRoomAllowed(`${DEFAULT}/`)).toBe(true)
    expect(isRoomAllowed('HTTPS://Shoutbox.pinme.dev/default?utm=x#frag')).toBe(true)
  })

  it('refuses every other room', () => {
    expect(isRoomAllowed('https://shoutbox.pinme.dev/general')).toBe(false)
    expect(isRoomAllowed('https://example.com/anything')).toBe(false)
    expect(isRoomAllowed('not a url')).toBe(false)
    expect(isRoomAllowed('')).toBe(false)
    expect(isRoomAllowed(null)).toBe(false)
    expect(isRoomAllowed(undefined)).toBe(false)
  })

  it('collapses anything unrecognized onto the allowed room instead of throwing', () => {
    expect(resolveRoom(DEFAULT)).toBe(DEFAULT)
    expect(resolveRoom('https://shoutbox.pinme.dev/general')).toBe(DEFAULT)
    expect(resolveRoom('nonsense')).toBe(DEFAULT)
    expect(resolveRoom(null)).toBe(DEFAULT)
    expect(resolveRoom('')).toBe(DEFAULT)
  })

  it('labels a room from its last path segment', () => {
    expect(roomLabel(DEFAULT)).toBe('default')
    expect(roomLabel('https://shoutbox.pinme.dev/web3-dev')).toBe('web3 dev')
    expect(roomLabel('https://shoutbox.pinme.dev')).toBe('shoutbox.pinme.dev')
    expect(roomLabel('::::')).toBe('::::')
  })
})

describe('room policy (VITE_ALLOWED_ROOMS=*)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('serves every valid URL and offers no fixed list', async () => {
    vi.stubEnv('VITE_ALLOWED_ROOMS', '*')
    vi.resetModules()
    const policy = await import('@/lib/roomPolicy')

    expect(policy.ALLOW_ALL).toBe(true)
    expect(policy.ALLOWED_ROOMS).toEqual([])
    expect(policy.isRoomAllowed('https://shoutbox.pinme.dev/general')).toBe(true)
    expect(policy.resolveRoom('https://shoutbox.pinme.dev/general')).toBe('https://shoutbox.pinme.dev/general')
    // Still not a room: the wildcard lifts the allowlist, not URL validity.
    expect(policy.isRoomAllowed('nonsense')).toBe(false)
    expect(policy.resolveRoom('nonsense')).toBe(policy.DEFAULT_ROOM)
  })
})
