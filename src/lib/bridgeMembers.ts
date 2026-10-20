/**
 * Standing members: addresses the leader adds to every room group it creates,
 * on top of the online participants. Used to seat an xmtp-bridge (the
 * rate-limited relay to an AI agent) in every room without the bridge having
 * to take part in GunDB presence.
 *
 * Configured via VITE_SHOUTBOX_BRIDGE_ADDRESSES (comma-separated 0x addresses).
 */

const ETH_ADDRESS = /^0x[0-9a-fA-F]{40}$/

/** Parse the env value: trims, lower-cases, drops blanks, invalid entries and duplicates. */
export function parseBridgeAddresses(raw: string | undefined | null): string[] {
  if (!raw) return []
  const out: string[] = []
  for (const part of raw.split(',')) {
    const addr = part.trim().toLowerCase()
    if (!ETH_ADDRESS.test(addr) || out.includes(addr)) continue
    out.push(addr)
  }
  return out
}

/** Online participants plus standing members, lower-cased and deduplicated, order preserved. */
export function mergeMemberAddresses(online: readonly string[], standing: readonly string[]): string[] {
  const out: string[] = []
  for (const a of [...online, ...standing]) {
    const addr = a.trim().toLowerCase()
    if (!addr || out.includes(addr)) continue
    out.push(addr)
  }
  return out
}

/**
 * Default standing member: the xmtp-bridge room identity on this project's
 * agent host. Used when VITE_SHOUTBOX_BRIDGE_ADDRESSES is unset or blank so
 * rooms seat the bridge without any configuration.
 */
export const DEFAULT_BRIDGE_ADDRESSES = '0x90779a7582aafb91b9ad78e9f3a3cba88ed44042'

/** Standing members: explicit config wins; unset/blank falls back to the default bridge. */
export function resolveBridgeAddresses(raw: string | undefined | null): string[] {
  const parsed = parseBridgeAddresses(raw)
  if (parsed.length > 0) return parsed
  return parseBridgeAddresses(DEFAULT_BRIDGE_ADDRESSES)
}

/** Standing members from the build-time environment. */
export const BRIDGE_ADDRESSES: readonly string[] = resolveBridgeAddresses(
  import.meta.env.VITE_SHOUTBOX_BRIDGE_ADDRESSES,
)
