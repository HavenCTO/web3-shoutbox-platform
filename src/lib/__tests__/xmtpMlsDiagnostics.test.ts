import { describe, expect, it } from 'vitest'
import { MessagingError } from '@/types/errors'
import { XMTP_MLS_SYNC_LIKELY_CODE } from '@/types/errors'
import {
  buildXmtpMlsDiagnosticRecord,
  serializeErrorForDiagnostics,
  shouldEmitXmtpMlsDiagnostics,
} from '@/lib/xmtpMlsDiagnostics'

describe('serializeErrorForDiagnostics', () => {
  it('serializes MessagingError with code and stack preview cap', () => {
    const err = new MessagingError('decrypt failed', XMTP_MLS_SYNC_LIKELY_CODE)
    err.stack = 'x'.repeat(3_000)
    const s = serializeErrorForDiagnostics(err)
    expect(s.name).toBe('MessagingError')
    expect(s.message).toBe('decrypt failed')
    expect(s.code).toBe(XMTP_MLS_SYNC_LIKELY_CODE)
    expect(s.stackPreview).toBeDefined()
    expect(s.stackPreview!.length).toBeLessThan(3_100)
    expect(s.stackPreview!.endsWith('…[truncated]')).toBe(true)
  })

  it('serializes generic Error', () => {
    const err = new Error('boom')
    const s = serializeErrorForDiagnostics(err)
    expect(s.name).toBe('Error')
    expect(s.message).toBe('boom')
    expect(s.code).toBeNull()
  })

  it('serializes non-Error values', () => {
    const s = serializeErrorForDiagnostics(42)
    expect(s.name).toBe('NonError')
    expect(s.message).toBe('42')
  })
})

describe('buildXmtpMlsDiagnosticRecord', () => {
  it('returns null for unrelated errors', () => {
    expect(
      buildXmtpMlsDiagnosticRecord({
        operation: 'test',
        message: 'Network timeout',
        error: new Error('Network timeout'),
      }),
    ).toBeNull()
  })

  it('builds a record when SecretReuse-style text is present', () => {
    const raw = new Error('SecretReuseError: key reused')
    const rec = buildXmtpMlsDiagnosticRecord({
      operation: 'stream.onError',
      message: raw.message,
      resolvedCode: null,
      error: raw,
      groupId: 'grp-test',
      inboxId: 'inbox-test',
      extras: { streamDisableSync: true },
    })
    expect(rec).not.toBeNull()
    expect(rec!.secretReuseLikely).toBe(true)
    expect(rec!.mlsOrDecryptLikely).toBe(true)
    expect(rec!.groupId).toBe('grp-test')
    expect(rec!.inboxId).toBe('inbox-test')
    expect(rec!.sdk.name).toBe('@xmtp/browser-sdk')
    expect(rec!.sdk.version.length).toBeGreaterThan(0)
    expect(rec!.extras).toEqual({ streamDisableSync: true })
  })

  it('builds a record when resolved code is MLS_SYNC_LIKELY', () => {
    const rec = buildXmtpMlsDiagnosticRecord({
      operation: 'wrap',
      message: 'opaque',
      resolvedCode: XMTP_MLS_SYNC_LIKELY_CODE,
      error: new Error('opaque'),
    })
    expect(rec).not.toBeNull()
    expect(rec!.resolvedCode).toBe(XMTP_MLS_SYNC_LIKELY_CODE)
  })
})

describe('shouldEmitXmtpMlsDiagnostics', () => {
  it('is a defined boolean', () => {
    expect(typeof shouldEmitXmtpMlsDiagnostics()).toBe('boolean')
  })
})
