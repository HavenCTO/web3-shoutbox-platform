import { describe, expect, it, vi } from 'vitest'
import type { Group } from '@xmtp/browser-sdk'

vi.mock('@/config/env', () => ({
  env: {
    VITE_WALLETCONNECT_PROJECT_ID: 'test-wc',
    VITE_XMTP_ENV: 'dev' as const,
    VITE_APP_URL: 'https://example.test',
    VITE_GUN_RELAY_PEERS: 'https://gun-manhattan.herokuapp.com/gun',
    VITE_SLIDING_WINDOW_MINUTES: 5,
  },
}))

import { streamGroupMessages } from '@/services/messagingService'

function makeDecodedMessage(id: string, conversationId: string) {
  return {
    id,
    senderInboxId: 'inbox',
    content: 'hello',
    sentAt: new Date(0),
    conversationId,
  }
}

describe('streamGroupMessages', () => {
  it('passes disableSync and onFail/onError to group.stream', async () => {
    const captured: unknown[] = []
    const mockStream = {
      end: vi.fn().mockResolvedValue({ value: undefined, done: true }),
      isDone: false,
      async *[Symbol.asyncIterator]() {
        yield makeDecodedMessage('m1', 'gid')
      },
    }

    const stream = vi.fn(async (opts: unknown) => {
      captured.push(opts)
      return mockStream
    })

    const group = { stream } as unknown as Group
    const received: string[] = []

    streamGroupMessages(group, (msg) => {
      received.push(msg.id)
    })

    await vi.waitFor(() => expect(stream).toHaveBeenCalled())
    expect(captured[0]).toMatchObject({
      disableSync: true,
    })
    expect(typeof (captured[0] as { onError?: (e: Error) => void }).onError).toBe('function')
    expect(typeof (captured[0] as { onFail?: () => void }).onFail).toBe('function')

    await vi.waitFor(() => expect(received).toEqual(['m1']))
  })

  it('invokes callback once per message id when the iterator yields duplicates', async () => {
    const mockStream = {
      end: vi.fn().mockResolvedValue({ value: undefined, done: true }),
      isDone: false,
      async *[Symbol.asyncIterator]() {
        const m = makeDecodedMessage('dup', 'g')
        yield m
        yield m
      },
    }

    const stream = vi.fn(async () => mockStream)
    const group = { stream } as unknown as Group
    const received: string[] = []

    streamGroupMessages(group, (msg) => {
      received.push(msg.id)
    })

    await vi.waitFor(() => expect(received).toEqual(['dup']))
  })
})
