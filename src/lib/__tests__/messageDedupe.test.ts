import { describe, expect, it } from 'vitest'
import { dedupeShoutboxMessagesById } from '@/lib/messageDedupe'
import type { ShoutboxMessage } from '@/types/message'

function msg(partial: Partial<ShoutboxMessage> & Pick<ShoutboxMessage, 'id'>): ShoutboxMessage {
  return {
    senderInboxId: 'in',
    senderAddress: '',
    content: 'c',
    timestamp: 0,
    groupId: 'g',
    ...partial,
  }
}

describe('dedupeShoutboxMessagesById', () => {
  it('returns empty for empty input', () => {
    expect(dedupeShoutboxMessagesById([])).toEqual([])
  })

  it('keeps order and drops later duplicates by id', () => {
    const a = msg({ id: '1', content: 'first' })
    const b = msg({ id: '2' })
    const aDup = msg({ id: '1', content: 'second' })
    expect(dedupeShoutboxMessagesById([a, b, aDup])).toEqual([a, b])
  })

  it('does not mutate the input array', () => {
    const arr = [msg({ id: 'x' }), msg({ id: 'x', content: 'y' })]
    const copy = [...arr]
    dedupeShoutboxMessagesById(arr)
    expect(arr).toEqual(copy)
  })
})
