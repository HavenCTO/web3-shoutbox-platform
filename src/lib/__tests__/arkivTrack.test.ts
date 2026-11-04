import { describe, it, expect } from 'vitest'
import { trackFromEntity, decodePayload } from '../arkivTrack'

describe('trackFromEntity', () => {
  it('free entity: fcid, no gate', () => {
    const t = trackFromEntity('0xabc', { grp: 'haven.audio.full', title: 'Song' }, { fcid: 'bafkreix', ct: 'audio/mpeg' }, 'fallback')
    expect(t.gated).toBe(false); expect(t.filecoinCid).toBe('bafkreix'); expect(t.title).toBe('Song')
  })
  it('gated entity: piece + gate', () => {
    const t = trackFromEntity('0xabc', { gate_type: 3, gate_token: '0xT', gate_threshold: 1 }, { piece: 'bafkzci', gate: { version: 3 } }, 'fallback')
    expect(t.gated).toBe(true); expect(t.pieceCid).toBe('bafkzci'); expect(t.gateToken).toBe('0xT')
  })
  it('decodePayload handles base64 JSON', () => {
    expect(decodePayload(btoa(JSON.stringify({ a: 1 })))).toEqual({ a: 1 })
    expect(decodePayload('not json')).toBeNull()
  })
})
