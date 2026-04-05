import { describe, it, expect } from 'vitest'
import {
  inboxPrefix,
  mergeTriggerIntoTranscript,
  type TextMessageRow,
} from './shoutboxContext.js'

describe('inboxPrefix', () => {
  it('returns short ids unchanged', () => {
    expect(inboxPrefix('abc')).toBe('abc')
  })

  it('truncates long inbox ids', () => {
    expect(inboxPrefix('abcdefghijklmnop')).toBe('abcdefgh')
  })

  it('trims whitespace', () => {
    expect(inboxPrefix('  xyz  ')).toBe('xyz')
  })
})

describe('mergeTriggerIntoTranscript', () => {
  const a: TextMessageRow = {
    id: '1',
    senderInboxId: 's1',
    content: 'a',
    sentAtMs: 1,
  }

  it('appends when trigger id is new', () => {
    const trigger: TextMessageRow = {
      id: '2',
      senderInboxId: 's2',
      content: 'b',
      sentAtMs: 2,
    }
    expect(mergeTriggerIntoTranscript([a], trigger)).toEqual([a, trigger])
  })

  it('does not duplicate when id already exists', () => {
    expect(mergeTriggerIntoTranscript([a], a)).toEqual([a])
  })
})
