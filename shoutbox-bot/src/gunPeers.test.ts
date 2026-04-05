import { describe, it, expect } from 'vitest'
import { DEFAULT_GUN_RELAY_PEERS } from './constants.js'
import { parseGunRelayPeers } from './gunPeers.js'

describe('parseGunRelayPeers', () => {
  it('returns defaults for undefined or blank input', () => {
    expect(parseGunRelayPeers(undefined)).toEqual(DEFAULT_GUN_RELAY_PEERS)
    expect(parseGunRelayPeers('')).toEqual(DEFAULT_GUN_RELAY_PEERS)
    expect(parseGunRelayPeers('  ')).toEqual(DEFAULT_GUN_RELAY_PEERS)
  })

  it('splits comma-separated peers', () => {
    expect(parseGunRelayPeers(' https://a/gun , https://b/gun ')).toEqual([
      'https://a/gun',
      'https://b/gun',
    ])
  })

  it('falls back to defaults when only commas/whitespace', () => {
    expect(parseGunRelayPeers(', ,')).toEqual(DEFAULT_GUN_RELAY_PEERS)
  })
})
