import { createPublicClient, http, parseAbi } from 'viem'
import { sepolia } from 'viem/chains'
import type { TrackInfo } from './arkivTrack'
import { env } from '@/config/env'
import { unwrapTrackKey, decryptSealedBytes, parseGate, GateUnlockError } from './haven-aol/decryptKey'
import { getGuestWallet } from './haven-aol/guestWallet'

export class GatedTrackError extends Error {
  constructor(message = 'Unlocking this release for you…') { super(message); this.name = 'GatedTrackError' }
}

const urls = new Map<string, string>()

/** Download a track's Filecoin piece bytes via Synapse (public, throwaway account). */
export async function downloadPieceBytes(track: TrackInfo, signal?: AbortSignal): Promise<Uint8Array> {
  const pieceCid = track.pieceCid ?? track.filecoinCid
  if (!pieceCid) throw new Error('This release has no playable locator yet.')
  const [{ Synapse }, synapseCore] = await Promise.all([
    import('@filoz/synapse-sdk'),
    import('@filoz/synapse-core/piece'),
  ])
  const { generatePrivateKey, privateKeyToAccount } = await import('viem/accounts')
  const synapse: unknown = await Synapse.create({ account: privateKeyToAccount(generatePrivateKey()), source: 'web3-shoutbox', withCDN: true })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = synapse as any
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = (synapseCore as any).tryFrom(pieceCid)
    if (track.owner && parsed) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const url = await (synapseCore as any).resolvePieceUrl({ address: track.owner.toLowerCase(), client: s.client, pieceCid: parsed, resolvers: [(synapseCore as any).filbeamResolver, (synapseCore as any).chainResolver], signal })
      const res = await fetch(url, { signal, credentials: 'omit' })
      if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`)
      return new Uint8Array(await res.arrayBuffer())
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e
  }
  return new Uint8Array(await s.storage.download({ pieceCid }))
}

const BALANCE_ABI = parseAbi(['function balanceOf(address) view returns (uint256)'])

/** Poll the guest's Sepolia balance until it reaches the gate threshold
 *  (the join top-up landing), up to ~90s. Other chains: no wait. */
export async function waitForGateBalance(gateRaw: unknown, timeoutMs = 90_000, signal?: AbortSignal): Promise<void> {
  const gate = parseGate(gateRaw)
  if (!gate || gate.chain !== 'EthSepolia' || typeof gate.tokenAddress !== 'string') return
  let threshold: bigint
  try { threshold = BigInt(String(gate.threshold)) } catch { return }
  const client = createPublicClient({ chain: sepolia, transport: http(env.VITE_SEPOLIA_RPC_URL) })
  const address = getGuestWallet().account.address as `0x${string}`
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (signal?.aborted) throw new Error('Cancelled')
    try {
      const bal = await client.readContract({ address: gate.tokenAddress as `0x${string}`, abi: BALANCE_ABI, functionName: 'balanceOf', args: [address] })
      if (bal >= threshold) return
    } catch { /* RPC hiccup — keep waiting until the deadline */ }
    if (Date.now() > deadline) return
    await new Promise((r) => setTimeout(r, 4000))
  }
}

/** Load any track (free or gated) to a playable blob URL. Cached per track. */
export async function loadTrackUrl(track: TrackInfo, signal?: AbortSignal): Promise<string> {
  const hit = urls.get(track.key)
  if (hit) return hit
  let plaintext: Uint8Array
  if (!track.gated) {
    plaintext = await downloadPieceBytes(track, signal)
  } else {
    const [sealed, aesKey] = await Promise.all([
      downloadPieceBytes(track, signal),
      (async () => {
        try {
          return await unwrapTrackKey(track.gate)
        } catch (e) {
          // Most likely the join top-up has not landed yet — wait, then retry once.
          if (e instanceof GateUnlockError && e.kind === 'insufficient') {
            await waitForGateBalance(track.gate, 90_000, signal)
            return unwrapTrackKey(track.gate)
          }
          throw e
        }
      })(),
    ])
    plaintext = await decryptSealedBytes(sealed, aesKey, signal)
  }
  const blob = new Blob([plaintext as BlobPart], { type: track.mime || 'audio/mpeg' })
  const url = URL.createObjectURL(blob)
  urls.set(track.key, url)
  return url
}

/** Back-compat name for the free-only loader. */
export const loadFreeTrackUrl = loadTrackUrl
