import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Client } from '@xmtp/node-sdk'
import type { BotConfig } from './botConfig.js'
import type { ShoutboxReplyContext } from './shoutboxContext.js'
import { defaultRuntimeImpl, startShoutboxRoomBotFromConfig } from './bootstrap.js'
import * as orchestrator from './orchestrator.js'

const hoistedOpenAI = vi.hoisted(() => {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content: 'llm-reply' } }],
  })
  const ctorCalls: unknown[] = []
  class MockOpenAI {
    readonly chat = { completions: { create } }
    constructor(opts: unknown) {
      ctorCalls.push(opts)
    }
  }
  return { MockOpenAI, create, ctorCalls }
})

vi.mock('openai', () => ({
  default: hoistedOpenAI.MockOpenAI,
}))

const hoisted = vi.hoisted(() => {
  const rootOn = vi.fn()
  const node: Record<string, unknown> = {
    get() {
      return node
    },
    put() {
      return node
    },
    on(cb: (data: unknown) => void) {
      queueMicrotask(() => {
        cb({
          groupId: 'local-test-group',
          epoch: 1,
          createdBy: 'c',
          createdAt: 0,
          expiresAt: Number.MAX_SAFE_INTEGER,
          windowMinutes: 5,
        })
      })
      return node
    },
    off() {
      return node
    },
    back() {
      return { _: { on: rootOn } }
    },
  }
  return { MockGun: vi.fn(() => node), rootOn }
})

vi.mock('gun', () => ({ default: hoisted.MockGun }))

const baseCfg: BotConfig = {
  roomUrl: 'https://room.test/',
  privateKey:
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  xmtpEnv: 'dev',
  gunRelayPeers: ['https://relay/gun'],
  contextMessageLimit: 50,
}

function pingCtx(): ShoutboxReplyContext {
  return {
    memberInboxIds: [],
    textMessages: [],
    botInboxId: 'b',
    trigger: { id: 't', senderInboxId: 'p', content: 'ping', sentAtMs: 0 },
  }
}

function minimalClient(): Client {
  return {
    inboxId: 'bot-i',
    conversations: {
      syncAll: vi.fn().mockResolvedValue(undefined),
      streamAllMessages: vi.fn().mockResolvedValue({
        end: vi.fn().mockResolvedValue(undefined),
      }),
      getConversationById: vi.fn(),
    },
  } as unknown as Client
}

describe('defaultRuntimeImpl', () => {
  afterEach(() => {
    hoisted.MockGun.mockClear()
  })

  it('forwards peers to the Gun constructor', () => {
    defaultRuntimeImpl.createGun(['https://peer/a'])
    expect(hoisted.MockGun).toHaveBeenCalledWith(
      expect.objectContaining({
        peers: ['https://peer/a'],
        localStorage: false,
        radisk: true,
        file: expect.stringMatching(/[\\/]radata$/),
        store: expect.objectContaining({
          put: expect.any(Function),
          get: expect.any(Function),
          list: expect.any(Function),
        }),
        WebSocket: expect.anything(),
      }),
    )
  })

  it('triggers dam:hi to initiate peer WebSocket connections', () => {
    hoisted.rootOn.mockClear()
    defaultRuntimeImpl.createGun(['https://peer/a'])
    expect(hoisted.rootOn).toHaveBeenCalledWith('out', { dam: 'hi' })
  })
})

describe('startShoutboxRoomBotFromConfig', () => {
  let runSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    hoistedOpenAI.ctorCalls.length = 0
    hoistedOpenAI.create.mockClear()
    hoistedOpenAI.create.mockResolvedValue({
      choices: [{ message: { content: 'llm-reply' } }],
    })
    runSpy = vi.spyOn(orchestrator, 'runShoutboxBot').mockImplementation(async (deps) => {
      const unsub = deps.groupSubscriber.subscribe('rk', vi.fn())
      const stopHb = deps.presence.start('rk', 'inbox', '0xabc')
      unsub()
      stopHb()
      return { stop: vi.fn().mockResolvedValue(undefined) }
    })
  })

  afterEach(() => {
    runSpy.mockRestore()
  })

  it('creates an XMTP client and starts the orchestrator', async () => {
    const createXmtpClient = vi.fn().mockResolvedValue(minimalClient())
    await startShoutboxRoomBotFromConfig(baseCfg, {
      ...defaultRuntimeImpl,
      createXmtpClient,
    })
    expect(createXmtpClient).toHaveBeenCalledWith({
      privateKey: baseCfg.privateKey,
      env: baseCfg.xmtpEnv,
      dbPath: undefined,
      dbEncryptionKey: undefined,
    })
    expect(runSpy).toHaveBeenCalledTimes(1)
    const arg = runSpy.mock.calls[0][0]
    expect(arg.cfg.roomUrl).toBe(baseCfg.roomUrl)
    expect(arg.cfg.botEthereumAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(hoistedOpenAI.ctorCalls).toEqual([])
    expect(arg.cfg.contextMessageLimit).toBe(50)
    await expect(arg.cfg.formatReply(pingCtx())).resolves.toBe('[bot] ping')
  })

  it('uses OpenAI chat completions when LLM config is present', async () => {
    const createXmtpClient = vi.fn().mockResolvedValue(minimalClient())
    const cfg: BotConfig = {
      ...baseCfg,
      contextMessageLimit: 40,
      llm: {
        baseUrl: 'http://localhost:3000/v1',
        apiKey: 'test-key',
        model: 'local',
        systemPrompt: 'You are a test bot.',
      },
    }
    await startShoutboxRoomBotFromConfig(cfg, {
      ...defaultRuntimeImpl,
      createXmtpClient,
    })
    expect(hoistedOpenAI.ctorCalls).toEqual([
      {
        baseURL: 'http://localhost:3000/v1',
        apiKey: 'test-key',
      },
    ])
    const arg = runSpy.mock.calls[0][0]
    expect(arg.cfg.contextMessageLimit).toBe(40)
    await expect(
      arg.cfg.formatReply({
        memberInboxIds: ['m1'],
        textMessages: [
          {
            id: 'b',
            senderInboxId: 'm1',
            content: 'hello',
            sentAtMs: 1,
          },
        ],
        botInboxId: 'bot',
        trigger: { id: 'b', senderInboxId: 'm1', content: 'hello', sentAtMs: 1 },
      }),
    ).resolves.toBe('llm-reply')
    const payload = hoistedOpenAI.create.mock.calls[0][0]
    expect(payload.model).toBe('local')
    expect(payload.messages[0].role).toBe('system')
    expect(String(payload.messages[0].content)).toContain('You are a test bot.')
    expect(payload.messages[1]).toEqual({ role: 'user', content: '[m1]: hello' })
  })
})
