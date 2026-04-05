import { DEFAULT_GUN_RELAY_PEERS } from './constants.js'

/** Split comma-separated peer list or return defaults. */
export function parseGunRelayPeers(raw: string | undefined): readonly string[] {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_GUN_RELAY_PEERS
  }
  const peers = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  return peers.length > 0 ? peers : DEFAULT_GUN_RELAY_PEERS
}
