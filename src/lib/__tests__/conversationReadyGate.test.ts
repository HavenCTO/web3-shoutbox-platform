import { describe, it, expect } from 'vitest'
import { isConversationReadyForGroup } from '@/lib/conversationReadyGate'

describe('isConversationReadyForGroup', () => {
  it('is false when there is no active group', () => {
    expect(isConversationReadyForGroup(null, 'a')).toBe(false)
  })

  it('is false when nothing has finished loading for the active id', () => {
    expect(isConversationReadyForGroup('a', null)).toBe(false)
  })

  it('is false when loaded id is a previous session', () => {
    expect(isConversationReadyForGroup('b', 'a')).toBe(false)
  })

  it('is true only when loaded id matches active id', () => {
    expect(isConversationReadyForGroup('same', 'same')).toBe(true)
  })
})
