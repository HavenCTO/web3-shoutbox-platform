import { describe, it, expect } from 'vitest'
import {
  isLikelySecretReuseError,
  isLikelyXmtpMlsOrDecryptError,
  resolveXmtpMessagingErrorCode,
} from '@/lib/xmtpMlsError'
import { XMTP_MLS_SYNC_LIKELY_CODE } from '@/types/errors'

describe('isLikelySecretReuseError', () => {
  it('returns true for secret reuse / SecretReuse wording', () => {
    expect(isLikelySecretReuseError('SecretReuseError: bad')).toBe(true)
    expect(isLikelySecretReuseError('secret reuse detected')).toBe(true)
    expect(isLikelySecretReuseError('Some reuse error occurred')).toBe(true)
  })

  it('returns false for unrelated text', () => {
    expect(isLikelySecretReuseError('Network timeout')).toBe(false)
    expect(isLikelySecretReuseError('Missing group secret')).toBe(false)
  })
})

describe('isLikelyXmtpMlsOrDecryptError', () => {
  it('returns true for forward secrecy wording', () => {
    expect(isLikelyXmtpMlsOrDecryptError('Forward secrecy check failed')).toBe(true)
  })

  it('returns true for decrypt failures', () => {
    expect(isLikelyXmtpMlsOrDecryptError('Failed to decrypt message')).toBe(true)
  })

  it('returns true for openmls / MLS references', () => {
    expect(isLikelyXmtpMlsOrDecryptError('openmls: bad epoch')).toBe(true)
    expect(isLikelyXmtpMlsOrDecryptError('MLS commit rejected')).toBe(true)
  })

  it('returns true when message mentions secret', () => {
    expect(isLikelyXmtpMlsOrDecryptError('Missing group secret')).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isLikelyXmtpMlsOrDecryptError('Network timeout')).toBe(false)
    expect(isLikelyXmtpMlsOrDecryptError('Rate limit exceeded')).toBe(false)
  })
})

describe('resolveXmtpMessagingErrorCode', () => {
  it('returns MLS code when message matches heuristics', () => {
    expect(resolveXmtpMessagingErrorCode('decrypt error', 'XMTP_OTHER')).toBe(XMTP_MLS_SYNC_LIKELY_CODE)
  })

  it('returns fallback when message does not match', () => {
    expect(resolveXmtpMessagingErrorCode('Something else', 'XMTP_SEND_MESSAGE_FAILED')).toBe(
      'XMTP_SEND_MESSAGE_FAILED',
    )
  })
})
