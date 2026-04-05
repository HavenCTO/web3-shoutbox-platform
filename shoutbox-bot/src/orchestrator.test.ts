import { describe, it, expect, vi } from 'vitest'
import type { DecodedMessage } from '@xmtp/node-sdk'
import { hashUrl, normalizeUrl } from './roomKey.js'
import { runShoutboxBot, type OrchestratorDeps } from './orchestrator.js'
import type { GroupWindow } from './groupWindow.js'
import type { ShoutboxXmtpPort } from './xmtpMessaging.js'

const VALID_GROUP: GroupWindow = {
  groupId: 'group-z',
  epoch: 1,
  createdBy: 'c',
  createdAt: 0,
  expiresAt: 999_999_999_999_999,
  windowMinutes: 5,
}

function fetchContextEmpty(): ShoutboxXmtpPort['fetchGroupChatContext'] {
  return vi.fn().mockResolvedValue({
    memberInboxIds: [],
    textMessages: [],
  })
}

function decodedText(
  conversationId: string,
  senderInboxId: string,
  content: string,
  id: string = 'mid',
): DecodedMessage {
  return {
    id,
    conversationId,
    senderInboxId,
    content,
    sentAt: new Date(42_000),
    contentType: {
      authorityId: 'xmtp.org',
      typeId: 'text',
      versionMajor: 1,
      versionMinor: 0,
    },
  } as DecodedMessage
}

describe('runShoutboxBot', () => {
  it('processes a peer message and sends a reply in the active group', async () => {
    const sends: { gid: string; text: string }[] = []
    let groupCb: ((gw: GroupWindow | null) => void) | null = null
    const fetchGroupChatContext = fetchContextEmpty()
    const log = vi.fn()

    const xmtp: ShoutboxXmtpPort = {
      inboxId: 'bot-inbox',
      syncAllowedConversations: vi.fn().mockResolvedValue(undefined),
      startAllMessagesStream: vi.fn().mockImplementation(async ({ onMessage }) => {
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            onMessage(decodedText('group-z', 'peer', 'yo'))
            resolve()
          }, 30)
        })
        return { close: vi.fn().mockResolvedValue(undefined) }
      }),
      fetchGroupChatContext,
      sendGroupText: vi.fn().mockImplementation(async (gid, text) => {
        sends.push({ gid, text })
      }),
    }

    const deps: OrchestratorDeps = {
      cfg: {
        roomUrl: 'https://example.com/r',
        botEthereumAddress: '0xbb',
        contextMessageLimit: 30,
        formatReply: async (ctx) => `echo:${ctx.trigger.content}`,
        log,
      },
      groupSubscriber: {
        subscribe: (_rk, cb) => {
          groupCb = cb
          cb(VALID_GROUP)
          return vi.fn()
        },
      },
      presence: {
        start: vi.fn().mockReturnValue(vi.fn()),
      },
      xmtp,
    }

    const handle = await runShoutboxBot(deps)
    const expectedRoomKey = await hashUrl('https://example.com/r')
    const expectedNorm = normalizeUrl('https://example.com/r')
    const expectedUi = `${expectedRoomKey.slice(0, 6)}…${expectedRoomKey.slice(-4)}`
    expect(log).toHaveBeenCalledWith(
      `[shoutbox-bot] room key ${expectedRoomKey} — UI # ${expectedUi} | ${expectedNorm}`,
    )
    await new Promise<void>((r) => {
      setTimeout(r, 60)
    })
    expect(groupCb).not.toBeNull()
    expect(fetchGroupChatContext).toHaveBeenCalledWith('group-z', 30)
    expect(sends).toEqual([{ gid: 'group-z', text: 'echo:yo' }])
    await handle.stop()
  })

  it('logs when the active group window is cleared', async () => {
    const log = vi.fn()
    let notifyGroup: (gw: GroupWindow | null) => void = () => {}

    const xmtp: ShoutboxXmtpPort = {
      inboxId: 'bot',
      syncAllowedConversations: vi.fn().mockResolvedValue(undefined),
      startAllMessagesStream: vi.fn().mockResolvedValue({
        close: vi.fn().mockResolvedValue(undefined),
      }),
      fetchGroupChatContext: fetchContextEmpty(),
      sendGroupText: vi.fn(),
    }

    const handle = await runShoutboxBot({
      cfg: {
        roomUrl: 'https://e.test/',
        botEthereumAddress: '0x1',
        contextMessageLimit: 10,
        formatReply: async (ctx) => ctx.trigger.content,
        log,
      },
      groupSubscriber: {
        subscribe: (_rk, cb) => {
          notifyGroup = cb
          return vi.fn()
        },
      },
      presence: { start: vi.fn().mockReturnValue(vi.fn()) },
      xmtp,
    })

    notifyGroup(null)
    expect(log).toHaveBeenCalledWith('[shoutbox-bot] no active group window')
    await handle.stop()
  })

  it('logs context fetch failures without sending', async () => {
    const sends: string[] = []
    const log = vi.fn()
    const xmtp: ShoutboxXmtpPort = {
      inboxId: 'bot-inbox',
      syncAllowedConversations: vi.fn().mockResolvedValue(undefined),
      startAllMessagesStream: vi.fn().mockImplementation(async ({ onMessage }) => {
        onMessage(decodedText('group-z', 'peer', 'x'))
        return { close: vi.fn().mockResolvedValue(undefined) }
      }),
      fetchGroupChatContext: vi.fn().mockRejectedValue(new Error('sync-boom')),
      sendGroupText: vi.fn().mockImplementation(async (_g, t) => {
        sends.push(t)
      }),
    }

    const handle = await runShoutboxBot({
      cfg: {
        roomUrl: 'https://e.test/',
        botEthereumAddress: '0x1',
        contextMessageLimit: 10,
        formatReply: async (ctx) => ctx.trigger.content,
        log,
      },
      groupSubscriber: {
        subscribe: (_rk, cb) => {
          cb(VALID_GROUP)
          return vi.fn()
        },
      },
      presence: { start: vi.fn().mockReturnValue(vi.fn()) },
      xmtp,
    })

    await new Promise<void>((r) => {
      setTimeout(r, 10)
    })
    expect(log).toHaveBeenCalledWith('[shoutbox-bot] context fetch failed: sync-boom')
    expect(sends).toEqual([])
    await handle.stop()
  })

  it('formats non-Error context fetch failures as strings', async () => {
    const log = vi.fn()
    const xmtp: ShoutboxXmtpPort = {
      inboxId: 'bot-inbox',
      syncAllowedConversations: vi.fn().mockResolvedValue(undefined),
      startAllMessagesStream: vi.fn().mockImplementation(async ({ onMessage }) => {
        onMessage(decodedText('group-z', 'peer', 'x'))
        return { close: vi.fn().mockResolvedValue(undefined) }
      }),
      fetchGroupChatContext: vi.fn().mockRejectedValue('offline'),
      sendGroupText: vi.fn(),
    }

    const handle = await runShoutboxBot({
      cfg: {
        roomUrl: 'https://e.test/',
        botEthereumAddress: '0x1',
        contextMessageLimit: 10,
        formatReply: async (ctx) => ctx.trigger.content,
        log,
      },
      groupSubscriber: {
        subscribe: (_rk, cb) => {
          cb(VALID_GROUP)
          return vi.fn()
        },
      },
      presence: { start: vi.fn().mockReturnValue(vi.fn()) },
      xmtp,
    })

    await new Promise<void>((r) => {
      setTimeout(r, 10)
    })
    expect(log).toHaveBeenCalledWith('[shoutbox-bot] context fetch failed: offline')
    await handle.stop()
  })

  it('logs reply generation failures without sending', async () => {
    const sends: string[] = []
    const log = vi.fn()
    const xmtp: ShoutboxXmtpPort = {
      inboxId: 'bot-inbox',
      syncAllowedConversations: vi.fn().mockResolvedValue(undefined),
      startAllMessagesStream: vi.fn().mockImplementation(async ({ onMessage }) => {
        onMessage(decodedText('group-z', 'peer', 'x'))
        return { close: vi.fn().mockResolvedValue(undefined) }
      }),
      fetchGroupChatContext: fetchContextEmpty(),
      sendGroupText: vi.fn().mockImplementation(async (_g, t) => {
        sends.push(t)
      }),
    }

    const handle = await runShoutboxBot({
      cfg: {
        roomUrl: 'https://e.test/',
        botEthereumAddress: '0x1',
        contextMessageLimit: 10,
        formatReply: async () => {
          throw new Error('llm-down')
        },
        log,
      },
      groupSubscriber: {
        subscribe: (_rk, cb) => {
          cb(VALID_GROUP)
          return vi.fn()
        },
      },
      presence: { start: vi.fn().mockReturnValue(vi.fn()) },
      xmtp,
    })

    await new Promise<void>((r) => {
      setTimeout(r, 10)
    })
    expect(log).toHaveBeenCalledWith('[shoutbox-bot] reply failed: llm-down')
    expect(sends).toEqual([])
    await handle.stop()
  })

  it('formats non-Error reply failures as strings', async () => {
    const log = vi.fn()
    const xmtp: ShoutboxXmtpPort = {
      inboxId: 'bot-inbox',
      syncAllowedConversations: vi.fn().mockResolvedValue(undefined),
      startAllMessagesStream: vi.fn().mockImplementation(async ({ onMessage }) => {
        onMessage(decodedText('group-z', 'peer', 'x'))
        return { close: vi.fn().mockResolvedValue(undefined) }
      }),
      fetchGroupChatContext: fetchContextEmpty(),
      sendGroupText: vi.fn(),
    }

    const handle = await runShoutboxBot({
      cfg: {
        roomUrl: 'https://e.test/',
        botEthereumAddress: '0x1',
        contextMessageLimit: 10,
        formatReply: async () => {
          throw 'plain-string-throw'
        },
        log,
      },
      groupSubscriber: {
        subscribe: (_rk, cb) => {
          cb(VALID_GROUP)
          return vi.fn()
        },
      },
      presence: { start: vi.fn().mockReturnValue(vi.fn()) },
      xmtp,
    })

    await new Promise<void>((r) => {
      setTimeout(r, 10)
    })
    expect(log).toHaveBeenCalledWith('[shoutbox-bot] reply failed: plain-string-throw')
    await handle.stop()
  })

  it('logs stream errors', async () => {
    const log = vi.fn()
    const xmtp: ShoutboxXmtpPort = {
      inboxId: 'bot',
      syncAllowedConversations: vi.fn().mockResolvedValue(undefined),
      startAllMessagesStream: vi.fn().mockImplementation(async ({ onError }) => {
        onError(new Error('boom'))
        return { close: vi.fn().mockResolvedValue(undefined) }
      }),
      fetchGroupChatContext: fetchContextEmpty(),
      sendGroupText: vi.fn(),
    }

    const handle = await runShoutboxBot({
      cfg: {
        roomUrl: 'https://e.test/',
        botEthereumAddress: '0x1',
        contextMessageLimit: 10,
        formatReply: async (ctx) => ctx.trigger.content,
        log,
      },
      groupSubscriber: {
        subscribe: () => vi.fn(),
      },
      presence: { start: vi.fn().mockReturnValue(vi.fn()) },
      xmtp,
    })

    expect(log).toHaveBeenCalledWith('[shoutbox-bot] stream error: boom')
    await handle.stop()
  })

  it('drops decoded messages that are not plain text', async () => {
    const sends: string[] = []
    const xmtp: ShoutboxXmtpPort = {
      inboxId: 'bot-inbox',
      syncAllowedConversations: vi.fn().mockResolvedValue(undefined),
      startAllMessagesStream: vi.fn().mockImplementation(async ({ onMessage }) => {
        await new Promise<void>((r) => {
          setTimeout(r, 30)
        })
        const reaction = {
          ...decodedText('group-z', 'peer', 'x'),
          content: undefined,
          contentType: {
            authorityId: 'xmtp.org',
            typeId: 'reaction',
            versionMajor: 1,
            versionMinor: 0,
          },
        } as DecodedMessage
        onMessage(reaction)
        return { close: vi.fn().mockResolvedValue(undefined) }
      }),
      fetchGroupChatContext: fetchContextEmpty(),
      sendGroupText: vi.fn().mockImplementation(async (_g, t) => {
        sends.push(t)
      }),
    }

    const handle = await runShoutboxBot({
      cfg: {
        roomUrl: 'https://e.test/',
        botEthereumAddress: '0x1',
        contextMessageLimit: 10,
        formatReply: async (ctx) => ctx.trigger.content,
        log: vi.fn(),
      },
      groupSubscriber: {
        subscribe: (_rk, cb) => {
          cb(VALID_GROUP)
          return vi.fn()
        },
      },
      presence: { start: vi.fn().mockReturnValue(vi.fn()) },
      xmtp,
    })

    await new Promise<void>((r) => {
      setTimeout(r, 60)
    })
    expect(sends).toEqual([])
    await handle.stop()
  })

  it('ignores messages that fail the shoutbox policy gate', async () => {
    const sends: string[] = []
    const xmtp: ShoutboxXmtpPort = {
      inboxId: 'bot-inbox',
      syncAllowedConversations: vi.fn().mockResolvedValue(undefined),
      startAllMessagesStream: vi.fn().mockImplementation(async ({ onMessage }) => {
        await new Promise<void>((r) => {
          setTimeout(r, 30)
        })
        onMessage(decodedText('group-z', 'bot-inbox', 'self-msg'))
        return { close: vi.fn().mockResolvedValue(undefined) }
      }),
      fetchGroupChatContext: fetchContextEmpty(),
      sendGroupText: vi.fn().mockImplementation(async (_g, t) => {
        sends.push(t)
      }),
    }

    const handle = await runShoutboxBot({
      cfg: {
        roomUrl: 'https://e.test/',
        botEthereumAddress: '0x1',
        contextMessageLimit: 10,
        formatReply: async (ctx) => ctx.trigger.content,
        log: vi.fn(),
      },
      groupSubscriber: {
        subscribe: (_rk, cb) => {
          cb(VALID_GROUP)
          return vi.fn()
        },
      },
      presence: { start: vi.fn().mockReturnValue(vi.fn()) },
      xmtp,
    })

    await new Promise<void>((r) => {
      setTimeout(r, 60)
    })
    expect(sends).toEqual([])
    await handle.stop()
  })

  it('logs send failures without throwing', async () => {
    const log = vi.fn()
    const xmtp: ShoutboxXmtpPort = {
      inboxId: 'bot',
      syncAllowedConversations: vi.fn().mockResolvedValue(undefined),
      startAllMessagesStream: vi.fn().mockImplementation(async ({ onMessage }) => {
        onMessage(decodedText('group-z', 'peer', 'x'))
        return { close: vi.fn().mockResolvedValue(undefined) }
      }),
      fetchGroupChatContext: fetchContextEmpty(),
      sendGroupText: vi.fn().mockRejectedValue(new Error('boom')),
    }

    const handle = await runShoutboxBot({
      cfg: {
        roomUrl: 'https://e.test/',
        botEthereumAddress: '0x1',
        contextMessageLimit: 10,
        formatReply: async (ctx) => ctx.trigger.content,
        log,
      },
      groupSubscriber: {
        subscribe: (_rk, cb) => {
          cb(VALID_GROUP)
          return vi.fn()
        },
      },
      presence: { start: vi.fn().mockReturnValue(vi.fn()) },
      xmtp,
    })

    await new Promise<void>((r) => {
      setTimeout(r, 10)
    })
    expect(log.mock.calls.some((c) => String(c[0]).includes('send failed'))).toBe(true)
    await handle.stop()
  })

  it('formats non-Error send failures as strings', async () => {
    const log = vi.fn()
    const xmtp: ShoutboxXmtpPort = {
      inboxId: 'bot',
      syncAllowedConversations: vi.fn().mockResolvedValue(undefined),
      startAllMessagesStream: vi.fn().mockImplementation(async ({ onMessage }) => {
        onMessage(decodedText('group-z', 'peer', 'x'))
        return { close: vi.fn().mockResolvedValue(undefined) }
      }),
      fetchGroupChatContext: fetchContextEmpty(),
      sendGroupText: vi.fn().mockRejectedValue('nope'),
    }

    const handle = await runShoutboxBot({
      cfg: {
        roomUrl: 'https://e.test/',
        botEthereumAddress: '0x1',
        contextMessageLimit: 10,
        formatReply: async (ctx) => ctx.trigger.content,
        log,
      },
      groupSubscriber: {
        subscribe: (_rk, cb) => {
          cb(VALID_GROUP)
          return vi.fn()
        },
      },
      presence: { start: vi.fn().mockReturnValue(vi.fn()) },
      xmtp,
    })

    await new Promise<void>((r) => {
      setTimeout(r, 10)
    })
    expect(log).toHaveBeenCalledWith('[shoutbox-bot] send failed: nope')
    await handle.stop()
  })
})
