import { describe, it, expect } from 'vitest'
import { parseGate, GateUnlockError, unwrapTrackKey, v3KeyExpiryMs } from '../haven-aol/decryptKey'
import { getGuestWallet, randomGateNonce } from '../haven-aol/guestWallet'
import { gateErrorKind } from '../haven-aol/canisterV3'
import { parseGateMetadataV3 } from '../haven-aol/core/v3'
import { buildGateRequestV3TypedData } from '../haven-aol/core/v3'
import { createTransportKeyPair, decryptFile } from '../haven-aol/core/crypto'

const V3 = {
  version: 3, cid: 'bafkzcibtest', chain: 'EthSepolia',
  tokenAddress: '0xF23a728b55BE576c75D98A8032982F85cBAD493E',
  threshold: '1000000000000000000', epoch: 692, encryptedAesKey: 'AAAA',
}

describe('gate parsing and dispatch', () => {
  it('parseGate accepts objects and JSON strings', () => {
    expect(parseGate(V3)?.version).toBe(3)
    expect(parseGate(JSON.stringify(V3))?.epoch).toBe(692)
    expect(parseGate('nope')).toBeNull()
    expect(parseGate(null)).toBeNull()
  })
  it('v3 metadata validates against the ported core', () => {
    const meta = parseGateMetadataV3(JSON.stringify(V3))
    expect(meta?.chain).toBe('EthSepolia')
    expect(meta?.threshold).toBe('1000000000000000000')
    expect(parseGateMetadataV3(JSON.stringify({ ...V3, threshold: '0' }))).toBeNull()
  })
  it('unsupported gate version fails explicitly, never silently', async () => {
    await expect(unwrapTrackKey({ version: 4 })).rejects.toMatchObject({ name: 'GateUnlockError', kind: 'unsupported' })
    await expect(unwrapTrackKey(null)).rejects.toBeInstanceOf(GateUnlockError)
  })
  it('canister error kinds map for the faucet-wait retry', () => {
    expect(gateErrorKind({ InsufficientBalance: { required: 1n, actual: 0n } })).toBe('insufficient')
    expect(gateErrorKind({ NonceAlreadyUsed: null })).toBe('nonce')
    expect(gateErrorKind({ VetKDError: 'x' })).toBe('other')
  })
})

describe('epoch expiry matches the canister 30-day epoch', () => {
  it('expires exactly at the Unix-anchored epoch end', () => {
    const EPOCH = 2_592_000_000
    expect(v3KeyExpiryMs(692) % EPOCH).toBe(0)
    expect(v3KeyExpiryMs(692) - 692 * EPOCH).toBe(EPOCH)
    expect(v3KeyExpiryMs(693) - v3KeyExpiryMs(692)).toBe(EPOCH)
  })
})

describe('guest wallet signer', () => {
  it('signs typed data silently with the ephemeral key', async () => {
    const wallet = getGuestWallet()
    expect(wallet.account.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
    const { publicKey } = createTransportKeyPair()
    const typed = buildGateRequestV3TypedData({
      evmAddress: wallet.account.address, transportPublicKey: publicKey,
      epoch: 692n, nonce: randomGateNonce(), eip712ChainId: 1n,
      eip712VerifyingContract: '0x0000000000000000000000000000000000000000',
    })
    const sig = await wallet.signTypedData({
      domain: typed.domain as unknown as Record<string, unknown>,
      types: typed.types as unknown as Record<string, unknown[]>,
      primaryType: typed.primaryType,
      message: typed.message as unknown as Record<string, unknown>,
    })
    expect(sig).toMatch(/^0x[0-9a-f]{130}$/)
    // Same identity on the second call — the XMTP guest, funded by the faucet.
    expect(getGuestWallet().account.address).toBe(wallet.account.address)
  })
  it('nonces are fresh', () => { expect(randomGateNonce()).not.toBe(randomGateNonce()) })
})

describe('sealed blob round-trip (core crypto)', () => {
  it('decryptFile opens an AES-GCM single-blob seal', async () => {
    const key = crypto.getRandomValues(new Uint8Array(32))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, 'AES-GCM', false, ['encrypt'])
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, cryptoKey, new TextEncoder().encode('hello mp3')))
    const sealed = new Uint8Array([...iv, ...ct])
    const plain = await decryptFile(sealed, key)
    expect(new TextDecoder().decode(plain)).toBe('hello mp3')
  })
})
