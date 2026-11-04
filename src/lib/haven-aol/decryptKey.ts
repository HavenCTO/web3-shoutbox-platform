/**
 * Unwrap a track's AES content key with the guest identity.
 * v3 (community epoch, Herald's default) and v1 (single file) gates;
 * v4 drip gates are rejected explicitly. Ported minimal path:
 * sign EIP-712 with the guest key -> canister VetKD -> IBE-unwrap.
 */
import { createTransportKeyPair, recoverVetKey, ibeDecryptAesKey, decryptFile } from './core/crypto'
import { computeDerivationInput } from './core/derivation'
import { computeDerivationInputV3, buildGateRequestV3TypedData, parseGateMetadataV3 } from './core/v3'
import { buildGateRequestTypedData, parseSignatureHex } from './core/eip712'
import { parseGateMetadata } from './core/metadata'
import { requestDecryptionKey } from './core/canister'
import { getAolConfig, getAgent, requestDecryptionKeyV3, gateErrorKind, gateErrorText } from './canisterV3'
import { getGuestWallet, randomGateNonce, type GuestWallet } from './guestWallet'
import { isChunkedFormat, decryptChunkedStream, concatenateChunks } from './chunkedDecrypt'

export class GateUnlockError extends Error {
  kind: 'insufficient' | 'unsupported' | 'failed'
  constructor(kind: GateUnlockError['kind'], message: string) { super(message); this.name = 'GateUnlockError'; this.kind = kind }
}

const vetKeyCache = new Map<string, ReturnType<typeof recoverVetKey>>()
const aesCache = new Map<string, Uint8Array>()

export function parseGate(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null
  if (typeof raw === 'string') { try { return JSON.parse(raw) as Record<string, unknown> } catch { return null } }
  return typeof raw === 'object' ? (raw as Record<string, unknown>) : null
}

async function unwrapV3(gate: Record<string, unknown>, wallet: GuestWallet): Promise<Uint8Array> {
  const meta = parseGateMetadataV3(JSON.stringify(gate))
  if (!meta) throw new GateUnlockError('failed', 'Unrecognised v3 gate on this release.')
  const cacheHit = aesCache.get(meta.encryptedAesKey)
  if (cacheHit) return cacheHit
  const gateKey = `${meta.chain}:${meta.tokenAddress}:${meta.threshold}:${meta.epoch}`
  let vetKey = vetKeyCache.get(gateKey)
  if (!vetKey) {
    const cfg = getAolConfig()
    const epoch = BigInt(meta.epoch)
    for (let attempt = 0; attempt < 3; attempt++) {
      const { secretKey, publicKey } = createTransportKeyPair()
      const nonce = randomGateNonce()
      const typed = buildGateRequestV3TypedData({ evmAddress: wallet.account.address, transportPublicKey: publicKey, epoch, nonce, eip712ChainId: cfg.eip712ChainId, eip712VerifyingContract: cfg.eip712VerifyingContract })
      const sigHex = await wallet.signTypedData({ domain: typed.domain as unknown as Record<string, unknown>, types: typed.types as unknown as Record<string, unknown[]>, primaryType: typed.primaryType, message: typed.message as unknown as Record<string, unknown> })
      const result = await requestDecryptionKeyV3({
        chain: meta.chain, tokenAddress: meta.tokenAddress, threshold: BigInt(meta.threshold), epoch,
        evmAddress: wallet.account.address, transportPublicKey: publicKey, nonce,
        signature: parseSignatureHex(sigHex), eip712ChainId: cfg.eip712ChainId, eip712VerifyingContract: cfg.eip712VerifyingContract,
      })
      if ('err' in result) {
        const kind = gateErrorKind(result.err)
        if (kind === 'nonce' && attempt < 2) continue
        throw new GateUnlockError(kind === 'insufficient' ? 'insufficient' : 'failed', gateErrorText(result.err))
      }
      const derivation = await computeDerivationInputV3(meta.chain, meta.tokenAddress, BigInt(meta.threshold), epoch)
      vetKey = recoverVetKey(result.ok.encryptedKey, secretKey, result.ok.verificationKey, derivation)
      vetKeyCache.set(gateKey, vetKey)
      break
    }
  }
  if (!vetKey) throw new GateUnlockError('failed', 'Could not obtain the unlock key.')
  const aes = ibeDecryptAesKey(meta.encryptedAesKey, vetKey)
  aesCache.set(meta.encryptedAesKey, aes)
  return aes
}

async function unwrapV1(gate: Record<string, unknown>, wallet: GuestWallet): Promise<Uint8Array> {
  const meta = parseGateMetadata(JSON.stringify(gate))
  const cacheHit = aesCache.get(meta.encryptedAesKey)
  if (cacheHit) return cacheHit
  const cfg = getAolConfig()
  const { secretKey, publicKey } = createTransportKeyPair()
  const nonce = randomGateNonce()
  const typed = buildGateRequestTypedData({ evmAddress: wallet.account.address, transportPublicKey: publicKey, nonce, eip712ChainId: cfg.eip712ChainId, eip712VerifyingContract: cfg.eip712VerifyingContract })
  const sigHex = await wallet.signTypedData({ domain: typed.domain as unknown as Record<string, unknown>, types: typed.types as unknown as Record<string, unknown[]>, primaryType: typed.primaryType, message: typed.message as unknown as Record<string, unknown> })
  const result = await requestDecryptionKey(await getAgent(), cfg.canisterId, {
    chain: meta.chain, tokenAddress: meta.tokenAddress, threshold: meta.threshold, cid: meta.cid,
    evmAddress: wallet.account.address, transportPublicKey: publicKey, nonce,
    signature: parseSignatureHex(sigHex), eip712ChainId: cfg.eip712ChainId, eip712VerifyingContract: cfg.eip712VerifyingContract,
  })
  if ('err' in result) {
    const kind = gateErrorKind(result.err)
    throw new GateUnlockError(kind === 'insufficient' ? 'insufficient' : 'failed', gateErrorText(result.err))
  }
  const derivation = await computeDerivationInput(meta.chain, meta.tokenAddress, meta.threshold, meta.cid)
  const vetKey = recoverVetKey(result.ok.encryptedKey, secretKey, result.ok.verificationKey, derivation)
  const aes = ibeDecryptAesKey(meta.encryptedAesKey, vetKey)
  aesCache.set(meta.encryptedAesKey, aes)
  return aes
}

/** AES key for a gated track, or a GateUnlockError explaining why not. */
export async function unwrapTrackKey(gateRaw: unknown, wallet: GuestWallet = getGuestWallet()): Promise<Uint8Array> {
  const gate = parseGate(gateRaw)
  if (!gate) throw new GateUnlockError('failed', 'This release has no readable gate.')
  if (gate.version === 3) return unwrapV3(gate, wallet)
  if (gate.version === 1) return unwrapV1(gate, wallet)
  throw new GateUnlockError('unsupported', `Gate v${String(gate.version)} releases cannot be unlocked in the shoutbox yet.`)
}

/** Decrypt sealed bytes (single-blob Herald seals, or haven-cli chunked). */
export async function decryptSealedBytes(sealed: Uint8Array, aesKey: Uint8Array, signal?: AbortSignal): Promise<Uint8Array> {
  if (isChunkedFormat(sealed)) {
    const chunks: Uint8Array[] = []
    for await (const c of decryptChunkedStream(sealed, aesKey, { signal })) chunks.push(c)
    return concatenateChunks(chunks)
  }
  return decryptFile(sealed, aesKey)
}
