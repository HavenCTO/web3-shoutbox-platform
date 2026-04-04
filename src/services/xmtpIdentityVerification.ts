/**
 * Resolve XMTP inbox states to Ethereum identifiers for sender verification.
 * Uses Client.fetchInboxStates + createBackend (network) so identities are populated;
 * preferences.fetchInboxStates alone often returns empty identities for remote inboxes.
 */

import { Client, createBackend, IdentifierKind } from '@xmtp/browser-sdk'
import { env } from '@/config/env'
import type { XmtpClient } from '@/lib/xmtp'

/** Doc / JSON sample shape */
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

/** True if this identity row is an Ethereum address per docs or WASM Identifier shape. */
export function ethereumAddressFromIdentityRow(row: unknown): string | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const id = typeof r.identifier === 'string' ? r.identifier.trim() : ''
  if (!id) return null

  // Docs: { kind: "ETHEREUM", identifier }
  if (typeof r.kind === 'string' && r.kind.toUpperCase() === 'ETHEREUM') {
    const n = normalizeEthereumAddress(id)
    return isLikelyEthereumAddress(n) ? n : null
  }

  // WASM / SDK: { identifierKind: IdentifierKind.Ethereum, identifier }
  const ik = r.identifierKind
  const isEthKind =
    ik === IdentifierKind.Ethereum ||
    ik === 'Ethereum' ||
    ik === 'ETHEREUM' ||
    (typeof ik === 'number' && ik === IdentifierKind.Ethereum)

  if (isEthKind) {
    const n = normalizeEthereumAddress(id)
    return isLikelyEthereumAddress(n) ? n : null
  }

  return null
}

export function ethereumAddressesFromInboxState(state: XmtpInboxStateRow | Record<string, unknown>): Set<string> {
  const out = new Set<string>()
  const identities = (state as { identities?: unknown }).identities
  if (!Array.isArray(identities)) return out
  for (const row of identities) {
    const addr = ethereumAddressFromIdentityRow(row)
    if (addr) out.add(addr)
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

async function fetchInboxStateRows(client: XmtpClient, inboxIds: string[]): Promise<unknown[]> {
  const unique = [...new Set(inboxIds.filter((id) => id.length > 0))]
  if (unique.length === 0) return []

  try {
    const backend = await createBackend({ env: env.VITE_XMTP_ENV })
    const rows = await Client.fetchInboxStates(unique, backend)
    if (Array.isArray(rows)) return rows
    console.warn('[shoutbox:xmtp-verify] Client.fetchInboxStates did not return an array', rows)
  } catch (e) {
    console.warn('[shoutbox:xmtp-verify] Client.fetchInboxStates failed, trying preferences', e)
  }

  const prefs = getPreferences(client)
  if (!prefs) {
    console.warn(
      '[shoutbox:xmtp-verify] No preferences.fetchInboxStates fallback — verified badges unavailable.',
    )
    return []
  }

  return prefs.fetchInboxStates(unique)
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

  let rows: unknown[]
  try {
    rows = await fetchInboxStateRows(client, unique)
  } catch (e) {
    console.warn('[shoutbox:xmtp-verify] fetch inbox states threw:', e)
    throw e
  }

  if (!Array.isArray(rows)) {
    console.warn('[shoutbox:xmtp-verify] inbox states returned non-array', rows)
    return result
  }

  const summary: Array<{
    inboxId: string
    identityKinds: string[]
    extractedEthereumAddresses: string[]
    rawIdentitySample?: unknown
  }> = []

  for (const raw of rows) {
    const state = raw as XmtpInboxStateRow & Record<string, unknown>
    if (!state?.inboxId) continue
    const extracted = ethereumAddressesFromInboxState(state)
    result.set(state.inboxId, extracted)

    const identities = state.identities
    const sample = Array.isArray(identities) && identities.length > 0 ? identities[0] : undefined

    summary.push({
      inboxId: state.inboxId,
      identityKinds: Array.isArray(identities)
        ? identities.map((i) => {
            if (!i || typeof i !== 'object') return '?'
            const o = i as Record<string, unknown>
            if (typeof o.kind === 'string') return o.kind
            if (o.identifierKind !== undefined) return String(o.identifierKind)
            return '?'
          })
        : [],
      extractedEthereumAddresses: [...extracted],
      rawIdentitySample: sample,
    })

    if (extracted.size === 0 && Array.isArray(identities) && identities.length > 0) {
      console.info(
        '[shoutbox:xmtp-verify] identities present but none parsed as Ethereum — first row:',
        identities[0],
      )
    }
  }

  console.info('[shoutbox:xmtp-verify] fetchInboxStates', {
    requestedInboxIds: unique,
    responseRowCount: rows.length,
    summary,
  })

  return result
}
