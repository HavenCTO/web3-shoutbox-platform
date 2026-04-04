import { describe, it, expect } from 'vitest'
import { IdentifierKind } from '@xmtp/browser-sdk'
import {
  isLikelyEthereumAddress,
  normalizeEthereumAddress,
  ethereumAddressesFromInboxState,
  isDisplayAddressVerifiedByXmtp,
} from '@/services/xmtpIdentityVerification'

describe('isLikelyEthereumAddress', () => {
  it('accepts 40-hex-prefixed addresses', () => {
    expect(isLikelyEthereumAddress('0x' + 'a'.repeat(40))).toBe(true)
  })

  it('rejects truncated display strings', () => {
    expect(isLikelyEthereumAddress('0x1234...abcd')).toBe(false)
  })

  it('rejects inbox id fallbacks', () => {
    expect(isLikelyEthereumAddress('637e32dc3f9ec9770b7e69c8b0262b6959ec864298ada870d2ef30957dd87fbb')).toBe(
      false,
    )
  })
})

describe('normalizeEthereumAddress', () => {
  it('lowercases', () => {
    expect(normalizeEthereumAddress('0xABCDEF0123456789ABCDEF0123456789ABCDEF01')).toBe(
      '0xabcdef0123456789abcdef0123456789abcdef01',
    )
  })
})

describe('ethereumAddressesFromInboxState', () => {
  it('collects ETHEREUM identities only', () => {
    const set = ethereumAddressesFromInboxState({
      inboxId: 'i1',
      identities: [
        { kind: 'ETHEREUM', identifier: '0x' + '1'.repeat(40) },
        { kind: 'PASSKEY', identifier: 'x' },
      ],
    })
    expect([...set]).toEqual([`0x${'1'.repeat(40)}`])
  })

  it('ignores invalid identifier strings', () => {
    const set = ethereumAddressesFromInboxState({
      inboxId: 'i1',
      identities: [{ kind: 'ETHEREUM', identifier: 'not-an-address' }],
    })
    expect(set.size).toBe(0)
  })

  it('collects WASM-style identifierKind + identifier rows', () => {
    const addr = `0x${'2'.repeat(40)}`
    const set = ethereumAddressesFromInboxState({
      inboxId: 'i1',
      identities: [{ identifierKind: IdentifierKind.Ethereum, identifier: addr }],
    })
    expect([...set]).toEqual([normalizeEthereumAddress(addr)])
  })
})

describe('isDisplayAddressVerifiedByXmtp', () => {
  it('returns true when display address is in XMTP set for inbox', () => {
    const addr = `0x${'a'.repeat(40)}`
    const map = new Map<string, Set<string>>([['inbox-1', new Set([addr])]])
    expect(isDisplayAddressVerifiedByXmtp('inbox-1', addr, map)).toBe(true)
  })

  it('returns false when map missing inbox', () => {
    expect(isDisplayAddressVerifiedByXmtp('x', `0x${'b'.repeat(40)}`, new Map())).toBe(false)
  })

  it('returns false for non-hex display', () => {
    const map = new Map<string, Set<string>>([['i', new Set([`0x${'c'.repeat(40)}`])]])
    expect(isDisplayAddressVerifiedByXmtp('i', '0xabc', map)).toBe(false)
  })
})
