import { describe, it, expect } from 'vitest'
import { DEFAULT_SHOUTBOX_LLM_SYSTEM_PROMPT } from './constants.js'
import { loadBotConfig } from './botConfig.js'

const VALID_PK =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const VALID_DB_KEY =
  '0x0000000000000000000000000000000000000000000000000000000000000001'

describe('loadBotConfig', () => {
  it('parses required env and defaults gun peers', () => {
    const cfg = loadBotConfig({
      SHOUTBOX_ROOM_URL: 'https://shoutbox.example/',
      SHOUTBOX_BOT_PRIVATE_KEY: VALID_PK,
      SHOUTBOX_XMTP_ENV: 'production',
    })
    expect(cfg.roomUrl).toBe('https://shoutbox.example/')
    expect(cfg.privateKey).toBe(VALID_PK)
    expect(cfg.xmtpEnv).toBe('production')
    expect(cfg.gunRelayPeers.length).toBeGreaterThan(0)
    expect(cfg.dbPath).toBeUndefined()
    expect(cfg.dbEncryptionKey).toBeUndefined()
    expect(cfg.contextMessageLimit).toBe(50)
  })

  it('reads VITE_ env fallbacks', () => {
    const cfg = loadBotConfig({
      SHOUTBOX_ROOM_URL: 'https://x.test/',
      SHOUTBOX_BOT_PRIVATE_KEY: VALID_PK,
      VITE_XMTP_ENV: 'dev',
      VITE_GUN_RELAY_PEERS: 'https://custom/gun',
    })
    expect(cfg.xmtpEnv).toBe('dev')
    expect(cfg.gunRelayPeers).toEqual(['https://custom/gun'])
  })

  it('accepts optional db path and encryption key', () => {
    const cfg = loadBotConfig({
      SHOUTBOX_ROOM_URL: 'https://x.test/',
      SHOUTBOX_BOT_PRIVATE_KEY: VALID_PK,
      SHOUTBOX_XMTP_ENV: 'dev',
      SHOUTBOX_BOT_DB_PATH: './bot.db3',
      SHOUTBOX_BOT_DB_ENCRYPTION_KEY: VALID_DB_KEY,
    })
    expect(cfg.dbPath).toBe('./bot.db3')
    expect(cfg.dbEncryptionKey?.byteLength).toBe(32)
  })

  it('throws on invalid private key', () => {
    expect(() =>
      loadBotConfig({
        SHOUTBOX_ROOM_URL: 'https://x.test/',
        SHOUTBOX_BOT_PRIVATE_KEY: '0xbad',
        SHOUTBOX_XMTP_ENV: 'dev',
      }),
    ).toThrow(/Invalid bot config/)
  })

  it('throws on invalid db encryption key via readOptionalHexKey', () => {
    expect(() =>
      loadBotConfig({
        SHOUTBOX_ROOM_URL: 'https://x.test/',
        SHOUTBOX_BOT_PRIVATE_KEY: VALID_PK,
        SHOUTBOX_XMTP_ENV: 'dev',
        SHOUTBOX_BOT_DB_ENCRYPTION_KEY: 'not-hex',
      }),
    ).toThrow(/SHOUTBOX_BOT_DB_ENCRYPTION_KEY/)
  })

  it('parses optional OpenAI-compatible LLM settings', () => {
    const cfg = loadBotConfig({
      SHOUTBOX_ROOM_URL: 'https://x.test/',
      SHOUTBOX_BOT_PRIVATE_KEY: VALID_PK,
      SHOUTBOX_XMTP_ENV: 'dev',
      SHOUTBOX_OPENAI_BASE_URL: 'http://localhost:3000/v1',
      SHOUTBOX_OPENAI_MODEL: 'local-model',
    })
    expect(cfg.llm).toEqual({
      baseUrl: 'http://localhost:3000/v1',
      apiKey: 'lm-studio',
      model: 'local-model',
      systemPrompt: DEFAULT_SHOUTBOX_LLM_SYSTEM_PROMPT,
    })
  })

  it('uses lm-studio API key when OPENAI_API_KEY is empty string', () => {
    const cfg = loadBotConfig({
      SHOUTBOX_ROOM_URL: 'https://x.test/',
      SHOUTBOX_BOT_PRIVATE_KEY: VALID_PK,
      SHOUTBOX_XMTP_ENV: 'dev',
      SHOUTBOX_OPENAI_BASE_URL: 'http://127.0.0.1:3000/v1',
      SHOUTBOX_OPENAI_MODEL: 'm',
      SHOUTBOX_OPENAI_API_KEY: '   ',
    })
    expect(cfg.llm?.apiKey).toBe('lm-studio')
  })

  it('accepts custom OpenAI API key and system prompt', () => {
    const cfg = loadBotConfig({
      SHOUTBOX_ROOM_URL: 'https://x.test/',
      SHOUTBOX_BOT_PRIVATE_KEY: VALID_PK,
      SHOUTBOX_XMTP_ENV: 'dev',
      SHOUTBOX_OPENAI_BASE_URL: 'https://api.openai.com/v1',
      SHOUTBOX_OPENAI_MODEL: 'gpt-4o-mini',
      SHOUTBOX_OPENAI_API_KEY: 'sk-test',
      SHOUTBOX_OPENAI_SYSTEM_PROMPT: 'Be brief.',
    })
    expect(cfg.llm?.apiKey).toBe('sk-test')
    expect(cfg.llm?.systemPrompt).toBe('Be brief.')
  })

  it('reads SHOUTBOX_BOT_CONTEXT_MESSAGE_LIMIT', () => {
    const cfg = loadBotConfig({
      SHOUTBOX_ROOM_URL: 'https://x.test/',
      SHOUTBOX_BOT_PRIVATE_KEY: VALID_PK,
      SHOUTBOX_XMTP_ENV: 'dev',
      SHOUTBOX_BOT_CONTEXT_MESSAGE_LIMIT: '120',
    })
    expect(cfg.contextMessageLimit).toBe(120)
  })

  it('throws on invalid context message limit', () => {
    expect(() =>
      loadBotConfig({
        SHOUTBOX_ROOM_URL: 'https://x.test/',
        SHOUTBOX_BOT_PRIVATE_KEY: VALID_PK,
        SHOUTBOX_XMTP_ENV: 'dev',
        SHOUTBOX_BOT_CONTEXT_MESSAGE_LIMIT: '0',
      }),
    ).toThrow(/SHOUTBOX_BOT_CONTEXT_MESSAGE_LIMIT/)
  })

  it('throws when OpenAI base URL is set without model', () => {
    expect(() =>
      loadBotConfig({
        SHOUTBOX_ROOM_URL: 'https://x.test/',
        SHOUTBOX_BOT_PRIVATE_KEY: VALID_PK,
        SHOUTBOX_XMTP_ENV: 'dev',
        SHOUTBOX_OPENAI_BASE_URL: 'http://localhost:3000/v1',
      }),
    ).toThrow(/SHOUTBOX_OPENAI_MODEL/)
  })
})
