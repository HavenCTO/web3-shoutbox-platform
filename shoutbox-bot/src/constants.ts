/** GunDB namespace — must match `src/lib/gun.ts` in the web app. */
export const GUN_NAMESPACE = 'shoutbox-v1'

/** Default public Gun relays (same default as web `env.ts`). */
export const DEFAULT_GUN_RELAY_PEERS: readonly string[] = [
  'https://gun-manhattan.herokuapp.com/gun',
  'https://gun-us.herokuapp.com/gun',
]

export const PRESENCE_HEARTBEAT_MS = 10_000

/** Recent plain-text XMTP messages to load for LLM / echo context (newest capped by limit). */
export const DEFAULT_CONTEXT_MESSAGE_LIMIT = 50

/** Default system prompt when SHOUTBOX_OPENAI_SYSTEM_PROMPT is unset. */
export const DEFAULT_SHOUTBOX_LLM_SYSTEM_PROMPT =
  'You are a concise, friendly assistant in a public shoutbox chat. Keep each reply short (under 280 characters) and safe for a public room.'
