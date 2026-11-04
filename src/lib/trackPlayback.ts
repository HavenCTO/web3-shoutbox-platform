import type { TrackInfo } from './arkivTrack'

export class GatedTrackError extends Error {
  constructor() { super('This release is gated — unlocking it for your guest identity…'); this.name = 'GatedTrackError' }
}

const urls = new Map<string, string>()

/** Download a free track's Filecoin piece and return a blob URL. Cached per track key. */
export async function loadFreeTrackUrl(track: TrackInfo, signal?: AbortSignal): Promise<string> {
  const hit = urls.get(track.key)
  if (hit) return hit
  if (track.gated) throw new GatedTrackError()
  const pieceCid = track.pieceCid ?? track.filecoinCid
  if (!pieceCid) throw new Error('This release has no playable locator yet.')
  const [{ Synapse }, synapseCore] = await Promise.all([
    import('@filoz/synapse-sdk'),
    import('@filoz/synapse-core/piece'),
  ])
  const { generatePrivateKey, privateKeyToAccount } = await import('viem/accounts')
  // Downloads of public pieces are free; the SDK only needs a throwaway account to bootstrap provider discovery.
  const synapse: unknown = await Synapse.create({ account: privateKeyToAccount(generatePrivateKey()), source: 'web3-shoutbox', withCDN: true })
  let bytes: Uint8Array
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = (synapseCore as any).tryFrom(pieceCid)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = synapse as any
    if (track.owner && parsed) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const url = await (synapseCore as any).resolvePieceUrl({ address: track.owner.toLowerCase(), client: s.client, pieceCid: parsed, resolvers: [(synapseCore as any).filbeamResolver, (synapseCore as any).chainResolver], signal })
      const res = await fetch(url, { signal, credentials: 'omit' })
      if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`)
      bytes = new Uint8Array(await res.arrayBuffer())
    } else {
      bytes = new Uint8Array(await s.storage.download({ pieceCid }))
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bytes = new Uint8Array(await (synapse as any).storage.download({ pieceCid }))
  }
  const blob = new Blob([bytes as BlobPart], { type: track.mime || 'audio/mpeg' })
  const url = URL.createObjectURL(blob)
  urls.set(track.key, url)
  return url
}
