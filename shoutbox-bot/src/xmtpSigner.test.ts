import { describe, it, expect } from 'vitest'
import { IdentifierKind } from '@xmtp/node-sdk'
import { createXmtpEoaSigner } from './xmtpSigner.js'

const VALID_PK =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

describe('createXmtpEoaSigner', () => {
  it('returns an EOA signer for the derived address', async () => {
    const signer = createXmtpEoaSigner(VALID_PK)
    expect(signer.type).toBe('EOA')
    const id = await Promise.resolve(signer.getIdentifier())
    expect(id.identifierKind).toBe(IdentifierKind.Ethereum)
    expect(id.identifier).toMatch(/^0x[0-9a-f]{40}$/)
  })

  it('signMessage returns raw signature bytes', async () => {
    const signer = createXmtpEoaSigner(VALID_PK)
    const sig = await signer.signMessage('hello world')
    expect(sig).toBeInstanceOf(Uint8Array)
    expect(sig.byteLength).toBeGreaterThan(0)
  })
})
