import { describe, it, expect } from 'vitest'
import { formatShoutboxReply } from './reply.js'
import type { ShoutboxReplyContext } from './shoutboxContext.js'

function ctxWithTrigger(content: string): ShoutboxReplyContext {
  return {
    memberInboxIds: [],
    textMessages: [],
    botInboxId: 'bot',
    trigger: {
      id: 't',
      senderInboxId: 'peer',
      content,
      sentAtMs: 0,
    },
  }
}

describe('formatShoutboxReply', () => {
  it('prefixes trimmed trigger text', () => {
    expect(formatShoutboxReply(ctxWithTrigger('  hello  '))).toBe('[bot] hello')
  })
})
