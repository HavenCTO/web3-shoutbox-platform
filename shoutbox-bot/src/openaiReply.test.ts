import { describe, it, expect, vi } from 'vitest'
import type OpenAI from 'openai'
import {
  buildChatCompletionMessages,
  createContextualPeerReplyGenerator,
} from './openaiReply.js'
import type { ShoutboxReplyContext } from './shoutboxContext.js'

function clientWithCompletionResult(result: unknown): OpenAI {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue(result),
      },
    },
  } as unknown as OpenAI
}

function baseCtx(over: Partial<ShoutboxReplyContext> = {}): ShoutboxReplyContext {
  return {
    memberInboxIds: ['alice-long-inbox-id', 'bob-inbox'],
    textMessages: [],
    botInboxId: 'bot-inbox-id',
    trigger: {
      id: 'tr',
      senderInboxId: 'alice-long-inbox-id',
      content: 'latest',
      sentAtMs: 99,
    },
    ...over,
  }
}

describe('buildChatCompletionMessages', () => {
  it('labels peer lines and uses assistant role for the bot', () => {
    const ctx = baseCtx({
      textMessages: [
        {
          id: '1',
          senderInboxId: 'alice-long-inbox-id',
          content: 'hi',
          sentAtMs: 1,
        },
        {
          id: '2',
          senderInboxId: 'bot-inbox-id',
          content: 'hello there',
          sentAtMs: 2,
        },
        {
          id: '3',
          senderInboxId: 'bob-inbox',
          content: 'yo',
          sentAtMs: 3,
        },
      ],
      trigger: {
        id: '3',
        senderInboxId: 'bob-inbox',
        content: 'yo',
        sentAtMs: 3,
      },
    })
    const msgs = buildChatCompletionMessages(ctx, 'You are helpful.')
    expect(msgs[0].role).toBe('system')
    expect(typeof msgs[0].content).toBe('string')
    expect(String(msgs[0].content)).toContain('You are helpful.')
    expect(String(msgs[0].content)).toContain('alice-lo')
    expect(String(msgs[0].content)).toContain('bob-inbo')
    expect(msgs.slice(1)).toEqual([
      { role: 'user', content: '[alice-lo]: hi' },
      { role: 'assistant', content: 'hello there' },
      { role: 'user', content: '[bob-inbo]: yo' },
    ])
  })

  it('sorts transcript by sentAtMs when rows are out of order', () => {
    const ctx = baseCtx({
      textMessages: [
        {
          id: '2',
          senderInboxId: 'bob-inbox',
          content: 'second',
          sentAtMs: 20,
        },
        {
          id: '1',
          senderInboxId: 'alice-long-inbox-id',
          content: 'first',
          sentAtMs: 10,
        },
      ],
      trigger: {
        id: '2',
        senderInboxId: 'bob-inbox',
        content: 'second',
        sentAtMs: 20,
      },
    })
    const msgs = buildChatCompletionMessages(ctx, 'Sys')
    expect(msgs.slice(1)).toEqual([
      { role: 'user', content: '[alice-lo]: first' },
      { role: 'user', content: '[bob-inbo]: second' },
    ])
  })

  it('omits participant enumeration when member list is empty', () => {
    const ctx = baseCtx({ memberInboxIds: [] })
    const msgs = buildChatCompletionMessages(ctx, 'S')
    const sys = String(msgs[0].content)
    expect(sys).not.toContain('Participants')
  })

  it('includes only the trigger when transcript is empty', () => {
    const ctx = baseCtx({
      memberInboxIds: [],
      textMessages: [],
    })
    const msgs = buildChatCompletionMessages(ctx, 'S')
    expect(msgs).toHaveLength(2)
    expect(msgs[1]).toEqual({
      role: 'user',
      content: '[alice-lo]: latest',
    })
  })
})

describe('createContextualPeerReplyGenerator', () => {
  it('posts built messages to chat completions', async () => {
    const client = clientWithCompletionResult({
      choices: [{ message: { content: ' reply ' } }],
    })
    const gen = createContextualPeerReplyGenerator(client, {
      model: 'm1',
      systemPrompt: 'sys',
    })
    await expect(gen(baseCtx())).resolves.toBe('reply')
    expect(client.chat.completions.create).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(client.chat.completions.create).mock.calls[0][0]
    expect(arg.model).toBe('m1')
    expect(Array.isArray(arg.messages)).toBe(true)
    expect(arg.messages!.length).toBeGreaterThanOrEqual(2)
  })

  it('throws when content is not a string', async () => {
    const client = clientWithCompletionResult({
      choices: [{ message: { content: null } }],
    })
    const gen = createContextualPeerReplyGenerator(client, {
      model: 'm',
      systemPrompt: 's',
    })
    await expect(gen(baseCtx())).rejects.toThrow(/no text content/)
  })

  it('throws when trimmed content is empty', async () => {
    const client = clientWithCompletionResult({
      choices: [{ message: { content: '   ' } }],
    })
    const gen = createContextualPeerReplyGenerator(client, {
      model: 'm',
      systemPrompt: 's',
    })
    await expect(gen(baseCtx())).rejects.toThrow(/empty text/)
  })

  it('throws when choices are missing', async () => {
    const client = clientWithCompletionResult({ choices: [] })
    const gen = createContextualPeerReplyGenerator(client, {
      model: 'm',
      systemPrompt: 's',
    })
    await expect(gen(baseCtx())).rejects.toThrow(/no text content/)
  })
})
