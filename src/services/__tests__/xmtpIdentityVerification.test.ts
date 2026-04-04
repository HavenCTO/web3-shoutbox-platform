import { describe, it, expect } from 'vitest'
import {
  isLikelyEthereumAddress,
  normalizeEthereumAddress,
  verificationPairKey,
} from '@/services/xmtpIdentityVerification'

describe('isLikelyEthereumAddress', () => {
  it('accepts 40-hex-prefixed addresses', () => {
    expect(isLikelyEthereumAddress('0x' + 'a'.repeat(40))).toBe(true)
  })

  it('rejects truncated display strings', () => {
    expect(isLikelyEthereumAddress('0x1234...abcd')).toBe(false)
  })
})

describe('normalizeEthereumAddress', () => {
  it('lowercases', () => {
    expect(normalizeEthereumAddress('0xABCDEF0123456789ABCDEF0123456789ABCDEF01')).toBe(
      '0xabcdef0123456789abcdef0123456789abcdef01',
    )
  })
})

describe('verificationPairKey', () => {
  it('is stable for inbox + address', () => {
    const a = verificationPairKey('inbox1', '0x' + '1'.repeat(40))
    const b = verificationPairKey('inbox1', '0x' + '1'.repeat(40))
    expect(a).toBe(b)
  })
})
