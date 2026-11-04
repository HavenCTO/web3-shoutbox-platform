import { env } from '@/config/env'
import type { TrackRef } from './trackAnnounce'

export interface TrackInfo {
  key: string
  title: string
  pieceCid: string | null
  filecoinCid: string | null
  mime: string
  gated: boolean
  gateToken: string | null
  gateChain: string | null
  gateThreshold: number | null
  gate: unknown | null
  owner: string | null
}

/** Pure: build TrackInfo from an Arkiv entity's attributes + decoded payload. */
export function trackFromEntity(
  key: string,
  attributes: Record<string, unknown>,
  payload: Record<string, unknown> | null,
  fallbackTitle: string,
  owner: string | null = null,
): TrackInfo {
  const data: Record<string, unknown> = { ...attributes, ...(payload ?? {}) }
  const gate = (data['gate'] as unknown) ?? null
  const str = (k: string) => (typeof data[k] === 'string' && data[k] ? (data[k] as string) : null)
  const mimeRaw = str('ct')
  return {
    key,
    title: str('title') ?? fallbackTitle,
    pieceCid: str('piece'),
    filecoinCid: str('fcid'),
    mime: mimeRaw && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(mimeRaw) ? mimeRaw : 'audio/mpeg',
    gated: gate !== null && gate !== undefined,
    gateToken: str('gate_token'),
    gateChain: data['gate_chain'] != null ? String(data['gate_chain']) : null,
    gateThreshold: typeof data['gate_threshold'] === 'number' ? (data['gate_threshold'] as number) : null,
    gate,
    owner,
  }
}

export function decodePayload(raw: unknown): Record<string, unknown> | null {
  try {
    if (raw instanceof Uint8Array) return JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>
    if (typeof raw === 'string') {
      try { return JSON.parse(atob(raw)) as Record<string, unknown> } catch { return JSON.parse(raw) as Record<string, unknown> }
    }
    if (raw && typeof raw === 'object') return raw as Record<string, unknown>
  } catch { /* fall through */ }
  return null
}

export function attributesToRecord(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (Array.isArray(raw)) {
    const out: Record<string, unknown> = {}
    for (const a of raw as Array<{ key?: string; value?: unknown }>) if (a?.key) out[a.key] = a.value
    return out
  }
  if (typeof raw === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      out[k] = (v as { value?: unknown })?.value !== undefined && typeof v === 'object' && v !== null && 'value' in (v as object) ? (v as { value: unknown }).value : v
    }
    return out
  }
  return {}
}

const cache = new Map<string, Promise<TrackInfo | null>>()

/** Fetch a track by Arkiv key (public, no wallet). Falls back to the announce ref. */
export function fetchTrack(ref: TrackRef): Promise<TrackInfo | null> {
  if (!ref.arkivKey) {
    return Promise.resolve({
      key: ref.pieceCid ?? '', title: ref.title, pieceCid: ref.pieceCid, filecoinCid: ref.filecoinCid,
      mime: 'audio/mpeg', gated: ref.pieceCid !== null && ref.filecoinCid === null, gateToken: null, gateChain: null, gateThreshold: null, gate: null, owner: null,
    })
  }
  const hit = cache.get(ref.arkivKey)
  if (hit) return hit
  const p = (async (): Promise<TrackInfo | null> => {
    try {
      const sdk = await import('@arkiv-network/sdk')
      const chains = await import('@arkiv-network/sdk/chains')
      const { http } = await import('viem')
      const client = sdk.createPublicClient({ chain: chains.tiramisu, transport: http(env.VITE_ARKIV_RPC_URL) })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entity: any = await (client as any).getEntity(ref.arkivKey as `0x${string}`)
      if (!entity) return null
      return trackFromEntity(ref.arkivKey as string, attributesToRecord(entity.attributes), decodePayload(entity.payload), ref.title, entity.owner ?? null)
    } catch { return null }
  })()
  cache.set(ref.arkivKey, p)
  return p
}
