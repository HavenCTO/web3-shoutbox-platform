import { z } from 'zod'
import { hexToBytes, type Hex } from 'viem'
import type { XmtpEnv } from '@xmtp/node-sdk'
import {
  DEFAULT_CONTEXT_MESSAGE_LIMIT,
  DEFAULT_SHOUTBOX_LLM_SYSTEM_PROMPT,
} from './constants.js'
import { parseGunRelayPeers } from './gunPeers.js'

const hex32Key = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, 'Must be 32-byte hex key with 0x prefix')

const xmtpEnvSchema = z.enum([
  'local',
  'dev',
  'production',
  'testnet-staging',
  'testnet-dev',
  'testnet',
  'mainnet',
]) as z.ZodType<XmtpEnv>

const botLlmConfigSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  systemPrompt: z.string().min(1),
})

export type BotLlmConfig = z.infer<typeof botLlmConfigSchema>

const botConfigSchema = z.object({
  roomUrl: z.string().url(),
  privateKey: hex32Key,
  xmtpEnv: xmtpEnvSchema,
  gunRelayPeers: z.array(z.string().min(1)),
  dbPath: z.string().min(1).optional(),
  dbEncryptionKey: z
    .instanceof(Uint8Array)
    .refine((u) => u.byteLength === 32, 'dbEncryptionKey must be 32 bytes')
    .optional(),
  llm: botLlmConfigSchema.optional(),
  contextMessageLimit: z.number().int().min(1).max(200),
})

export type BotConfig = z.infer<typeof botConfigSchema>

function readOptionalLlm(env: NodeJS.ProcessEnv): BotLlmConfig | undefined {
  const baseUrl = env.SHOUTBOX_OPENAI_BASE_URL?.trim()
  if (!baseUrl) return undefined
  const model = env.SHOUTBOX_OPENAI_MODEL?.trim()
  if (!model) {
    throw new Error(
      'SHOUTBOX_OPENAI_MODEL is required when SHOUTBOX_OPENAI_BASE_URL is set',
    )
  }
  const apiKeyRaw = env.SHOUTBOX_OPENAI_API_KEY?.trim()
  const apiKey = apiKeyRaw !== undefined && apiKeyRaw !== '' ? apiKeyRaw : 'lm-studio'
  const promptRaw = env.SHOUTBOX_OPENAI_SYSTEM_PROMPT?.trim()
  const systemPrompt =
    promptRaw !== undefined && promptRaw !== ''
      ? promptRaw
      : DEFAULT_SHOUTBOX_LLM_SYSTEM_PROMPT
  return {
    baseUrl,
    apiKey,
    model,
    systemPrompt,
  }
}

function readContextMessageLimit(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_CONTEXT_MESSAGE_LIMIT
  const n = Number.parseInt(raw.trim(), 10)
  if (!Number.isFinite(n) || n < 1 || n > 200) {
    throw new Error(
      'SHOUTBOX_BOT_CONTEXT_MESSAGE_LIMIT must be an integer from 1 to 200',
    )
  }
  return n
}

function readOptionalHexKey(raw: string | undefined): Uint8Array | undefined {
  if (raw === undefined || raw.trim() === '') return undefined
  const parsed = hex32Key.safeParse(raw.trim())
  if (!parsed.success) {
    throw new Error(`SHOUTBOX_BOT_DB_ENCRYPTION_KEY: ${parsed.error.message}`)
  }
  return hexToBytes(parsed.data as Hex)
}

/** Load and validate bot configuration from process environment. */
export function loadBotConfig(env: NodeJS.ProcessEnv): BotConfig {
  const roomUrl = env.SHOUTBOX_ROOM_URL
  const privateKey = env.SHOUTBOX_BOT_PRIVATE_KEY
  const xmtpEnv = env.SHOUTBOX_XMTP_ENV ?? env.VITE_XMTP_ENV
  const peersRaw = env.SHOUTBOX_GUN_RELAY_PEERS ?? env.VITE_GUN_RELAY_PEERS
  const dbPath = env.SHOUTBOX_BOT_DB_PATH
  const dbKeyRaw = env.SHOUTBOX_BOT_DB_ENCRYPTION_KEY

  const llm = readOptionalLlm(env)

  const base = {
    roomUrl,
    privateKey,
    xmtpEnv,
    gunRelayPeers: [...parseGunRelayPeers(peersRaw)] as string[],
    dbPath: dbPath && dbPath.trim() !== '' ? dbPath.trim() : undefined,
    dbEncryptionKey: readOptionalHexKey(dbKeyRaw),
    llm,
    contextMessageLimit: readContextMessageLimit(env.SHOUTBOX_BOT_CONTEXT_MESSAGE_LIMIT),
  }

  const result = botConfigSchema.safeParse(base)
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid bot config: ${msg}`)
  }
  return result.data
}
