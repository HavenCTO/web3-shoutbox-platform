/**
 * Resolve XMTP inbox states to Ethereum identifiers for sender verification.
 * Uses client.preferences.fetchInboxStates — not Gun presence.
 */

import type { XmtpClient } from '@/lib/xmtp'

/** Shape returned by XMTP for each identity on an inbox (see XMTP manage-inboxes docs). */
export interface XmtpInboxIdentityRow {
  kind: string
  identifier: string
  relyingPartner?: string
}

export interface XmtpInboxStateRow {
  inboxId: string
  recoveryIdentity?: string
  identities: XmtpInboxIdentityRow[]
  installations?: string[]
}

export function isLikelyEthereumAddress(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim())
}

export function normalizeEthereumAddress(s: string): string {
  return s.trim().toLowerCase()
}

/** Collects normalized 0x addresses from an inbox state (ETHEREUM kind only). */
export function ethereumAddressesFromInboxState(state: XmtpInboxStateRow): Set<string> {
  const out = new Set<string>()
  for (const row of state.identities ?? []) {
    const kind = row.kind?.toUpperCase() ?? ''
    if (kind !== 'ETHEREUM' || !row.identifier) continue
    const n = normalizeEthereumAddress(row.identifier)
    if (isLikelyEthereumAddress(n)) out.add(n)
  }
  return out
}

export function isDisplayAddressVerifiedByXmtp(
  senderInboxId: string,
  displayedAddress: string,
  inboxIdToAddresses: ReadonlyMap<string, ReadonlySet<string>>,
): boolean {
  const addrs = inboxIdToAddresses.get(senderInboxId)
  if (!addrs || addrs.size === 0) return false
  const d = displayedAddress.trim()
  if (!isLikelyEthereumAddress(d)) return false
  return addrs.has(normalizeEthereumAddress(d))
}

type PreferencesWithFetch = {
  fetchInboxStates: (inboxIds: string[]) => Promise<unknown[]>
}

function getPreferences(client: XmtpClient): PreferencesWithFetch | null {
  const prefs = client.preferences as Partial<PreferencesWithFetch> | undefined
  if (prefs && typeof prefs.fetchInboxStates === 'function') return prefs as PreferencesWithFetch
  return null
}

/**
 * Fetches inbox states from the XMTP network and maps inbox id → set of associated Ethereum addresses.
 */
export async function fetchInboxEthereumAddressMap(
  client: XmtpClient,
  inboxIds: string[],
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>()
  const unique = [...new Set(inboxIds.filter((id) => id.length > 0))]
  if (unique.length === 0) return result

  const prefs = getPreferences(client)
  if (!prefs) {
    console.warn(
      '[shoutbox:xmtp-verify] client.preferences.fetchInboxStates is missing — verified badges disabled. Check @xmtp/browser-sdk version.',
    )
    return result
  }

  let rows: unknown[]
  try {
    rows = await prefs.fetchInboxStates(unique)
  } catch (e) {
    console.warn('[shoutbox:xmtp-verify] fetchInboxStates threw:', e)
    throw e
  }

  if (!Array.isArray(rows)) {
    console.warn('[shoutbox:xmtp-verify] fetchInboxStates returned non-array', rows)
    return result
  }

  const summary: Array<{
    inboxId: string
    identityKinds: string[]
    extractedEthereumAddresses: string[]
  }> = []

  for (const raw of rows) {
    const state = raw as XmtpInboxStateRow
    if (!state?.inboxId) continue
    const extracted = ethereumAddressesFromInboxState(state)
    result.set(state.inboxId, extracted)
    summary.push({
      inboxId: state.inboxId,
      identityKinds: state.identities?.map((i) => i.kind) ?? [],
      extractedEthereumAddresses: [...extracted],
    })
  }

  console.info('[shoutbox:xmtp-verify] fetchInboxStates', {
    requestedInboxIds: unique,
    responseRowCount: Array.isArray(rows) ? rows.length : 0,
    summary,
  })

  return result
}
