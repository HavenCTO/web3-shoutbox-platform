import { describe, it, expect } from 'vitest'
import type { DecodedMessage } from '@xmtp/node-sdk'
import {
  shouldProcessShoutboxMessage,
  textFromDecodedMessage,
} from './messagePolicy.js'

function textMsg(partial: {
  conversationId: string
  senderInboxId: string
  content: string
}): DecodedMessage {
  return {
    conversationId: partial.conversationId,
    senderInboxId: partial.senderInboxId,
    content: partial.content,
    contentType: {
      authorityId: 'xmtp.org',
      typeId: 'text',
      versionMajor: 1,
      versionMinor: 0,
    },
  } as DecodedMessage
}

describe('shouldProcessShoutboxMessage', () => {
  const checkBase = {
    activeGroupId: 'g1',
    botInboxId: 'bot',
    conversationId: 'g1',
    senderInboxId: 'peer',
  }

  it('returns true for peer text in the active group', () => {
    expect(
      shouldProcessShoutboxMessage(textMsg({ ...checkBase, content: 'hi' }), checkBase),
    ).toBe(true)
  })

  it('skips when no active group', () => {
    expect(
      shouldProcessShoutboxMessage(textMsg({ ...checkBase, content: 'hi' }), {
        ...checkBase,
        activeGroupId: '',
      }),
    ).toBe(false)
  })

  it('skips other conversations', () => {
    expect(
      shouldProcessShoutboxMessage(
        textMsg({ ...checkBase, conversationId: 'other', content: 'hi' }),
        checkBase,
      ),
    ).toBe(false)
  })

  it('skips self-sent messages', () => {
    expect(
      shouldProcessShoutboxMessage(
        textMsg({ ...checkBase, senderInboxId: 'bot', content: 'hi' }),
        checkBase,
      ),
    ).toBe(false)
  })

  it('skips non-text content types', () => {
    const msg = textMsg({ ...checkBase, content: 'x' })
    const reactionMsg = {
      ...msg,
      content: undefined,
      contentType: {
        authorityId: 'xmtp.org',
        typeId: 'reaction',
        versionMajor: 1,
        versionMinor: 0,
      },
    } as DecodedMessage
    expect(shouldProcessShoutboxMessage(reactionMsg, checkBase)).toBe(false)
  })
})

describe('textFromDecodedMessage', () => {
  it('extracts string text content', () => {
    const msg = textMsg({
      conversationId: 'g',
      senderInboxId: 'p',
      content: 'hey',
    })
    expect(textFromDecodedMessage(msg)).toBe('hey')
  })

  it('returns null when the message is not a text content type', () => {
    const msg = textMsg({ conversationId: 'g', senderInboxId: 'p', content: 'x' })
    const nonText = {
      ...msg,
      contentType: {
        authorityId: 'xmtp.org',
        typeId: 'reaction',
        versionMajor: 1,
        versionMinor: 0,
      },
    } as DecodedMessage
    expect(textFromDecodedMessage(nonText)).toBeNull()
  })

  it('returns null when content is not text-shaped', () => {
    const msg = textMsg({ conversationId: 'g', senderInboxId: 'p', content: 'x' })
    const m2 = {
      ...msg,
      content: { not: 'string' },
    } as DecodedMessage
    expect(textFromDecodedMessage(m2)).toBeNull()
  })
})
