import { describe, it, expect, vi } from 'vitest'
import type { Client, DecodedMessage } from '@xmtp/node-sdk'
import { MessageSortBy, SortDirection } from '@xmtp/node-sdk'
import { createShoutboxXmtpPort } from './xmtpMessaging.js'

function textDecoded(
  id: string,
  senderInboxId: string,
  content: string,
  sentAtMs: number,
): DecodedMessage {
  return {
    id,
    senderInboxId,
    content,
    sentAt: new Date(sentAtMs),
    contentType: {
      authorityId: 'xmtp.org',
      typeId: 'text',
      versionMajor: 1,
      versionMinor: 0,
    },
  } as DecodedMessage
}

function mockClient(): {
  client: Client
  sendText: ReturnType<typeof vi.fn>
} {
  const sendText = vi.fn().mockResolvedValue(undefined)
  const client = {
    inboxId: 'inbox-1',
    conversations: {
      syncAll: vi.fn().mockResolvedValue(undefined),
      streamAllMessages: vi.fn().mockResolvedValue({ end: vi.fn().mockResolvedValue(undefined) }),
      getConversationById: vi.fn().mockResolvedValue({ sendText }),
    },
  } as unknown as Client
  return { client, sendText }
}

describe('createShoutboxXmtpPort', () => {
  it('exposes inbox id from the client', () => {
    const { client } = mockClient()
    const port = createShoutboxXmtpPort(client)
    expect(port.inboxId).toBe('inbox-1')
  })

  it('falls back to empty string when inbox id is missing', () => {
    const { client } = mockClient()
    const bare = { ...client, inboxId: undefined } as unknown as Client
    const port = createShoutboxXmtpPort(bare)
    expect(port.inboxId).toBe('')
  })

  it('delegates syncAllowedConversations to syncAll', async () => {
    const { client } = mockClient()
    const port = createShoutboxXmtpPort(client)
    await port.syncAllowedConversations()
    expect(client.conversations.syncAll).toHaveBeenCalled()
  })

  it('sendGroupText resolves the conversation and sends text', async () => {
    const { client, sendText } = mockClient()
    const port = createShoutboxXmtpPort(client)
    await port.sendGroupText('gid', 'hello')
    expect(client.conversations.getConversationById).toHaveBeenCalledWith('gid')
    expect(sendText).toHaveBeenCalledWith('hello')
  })

  it('throws when the group conversation is missing', async () => {
    const { client } = mockClient()
    vi.mocked(client.conversations.getConversationById).mockResolvedValue(undefined)
    const port = createShoutboxXmtpPort(client)
    await expect(port.sendGroupText('missing', 'x')).rejects.toThrow(/not found/)
  })

  it('fetchGroupChatContext syncs, lists members, and orders text messages oldest-first', async () => {
    const sync = vi.fn().mockResolvedValue(undefined)
    const members = vi.fn().mockResolvedValue([{ inboxId: 'm1' }, { inboxId: 'm2' }])
    const messages = vi.fn().mockResolvedValue([
      textDecoded('2', 'm2', 'second', 20),
      textDecoded('1', 'm1', 'first', 10),
    ])
    const client = {
      inboxId: 'bot',
      conversations: {
        syncAll: vi.fn().mockResolvedValue(undefined),
        streamAllMessages: vi.fn().mockResolvedValue({ end: vi.fn() }),
        getConversationById: vi.fn().mockResolvedValue({ sync, members, messages }),
      },
    } as unknown as Client
    const port = createShoutboxXmtpPort(client)
    const r = await port.fetchGroupChatContext('gid-1', 25)
    expect(client.conversations.getConversationById).toHaveBeenCalledWith('gid-1')
    expect(sync).toHaveBeenCalled()
    expect(members).toHaveBeenCalled()
    expect(messages).toHaveBeenCalledWith({
      limit: 25,
      sortBy: MessageSortBy.SentAt,
      direction: SortDirection.Descending,
    })
    expect(r.memberInboxIds).toEqual(['m1', 'm2'])
    expect(r.textMessages).toEqual([
      {
        id: '1',
        senderInboxId: 'm1',
        content: 'first',
        sentAtMs: 10,
      },
      {
        id: '2',
        senderInboxId: 'm2',
        content: 'second',
        sentAtMs: 20,
      },
    ])
  })

  it('fetchGroupChatContext throws when the conversation is missing', async () => {
    const client = {
      inboxId: 'bot',
      conversations: {
        syncAll: vi.fn().mockResolvedValue(undefined),
        streamAllMessages: vi.fn().mockResolvedValue({ end: vi.fn() }),
        getConversationById: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as Client
    const port = createShoutboxXmtpPort(client)
    await expect(port.fetchGroupChatContext('x', 3)).rejects.toThrow(/not found/)
  })

  it('startAllMessagesStream wires handlers and returns closable stream', async () => {
    const { client } = mockClient()
    const port = createShoutboxXmtpPort(client)
    const onMessage = vi.fn()
    const onError = vi.fn()
    const end = vi.fn().mockResolvedValue(undefined)
    vi.mocked(client.conversations.streamAllMessages).mockResolvedValue({
      end,
    } as never)

    const s = await port.startAllMessagesStream({ onMessage, onError })
    const opts = vi.mocked(client.conversations.streamAllMessages).mock.calls[0][0]
    expect(opts?.onValue).toBeDefined()
    expect(opts?.onError).toBe(onError)
    opts?.onValue?.({ id: 'm1' } as never)
    expect(onMessage).toHaveBeenCalledWith({ id: 'm1' })

    await s.close()
    expect(end).toHaveBeenCalled()
  })
})
