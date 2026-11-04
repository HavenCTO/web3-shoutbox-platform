/**
 * Environment Variable Validation
 *
 * Validates and types all environment variables at startup using Zod.
 * Throws a descriptive error if any required variable is missing or invalid.
 *
 * Usage:
 *   import { env } from '@/config/env'
 */

import { z } from 'zod'
import { normalizeViteAppUrl } from './normalizeViteAppUrl'

const envSchema = z.object({
  // No longer used: chat identity is auto-generated locally, no wallet connection.
  VITE_WALLETCONNECT_PROJECT_ID: z.string().optional().default(''),

  VITE_XMTP_ENV: z.enum(['dev', 'production'], {
    message: 'XMTP environment must be "dev" or "production"',
  }),

  VITE_APP_URL: z.string().url('App URL must be a valid URL'),

  // Presence/group coordination needs a reachable Gun relay. The previous
  // defaults (a personal ngrok tunnel and peer.wallie.io) are both dead, which
  // left every browser isolated. Default to the local relay (`npm run relay`);
  // set VITE_GUN_RELAY_PEERS to a hosted relay URL in production.
  VITE_GUN_RELAY_PEERS: z
    .string()
    .optional()
    .default('http://localhost:8765/gun'),

  VITE_SLIDING_WINDOW_MINUTES: z.coerce.number().positive().optional().default(60),

  // Embedded playback: Arkiv (Tiramisu) RPC for track lookup. Public read-only.
  VITE_ARKIV_RPC_URL: z.string().url().optional().default('https://rpc.tiramisu.db-chain.testnet.arkiv.network'),

  // Sepolia RPC for silent gate-balance reads for the guest identity.
  VITE_SEPOLIA_RPC_URL: z.string().url().optional().default('https://ethereum-sepolia-rpc.publicnode.com'),

  // Join = top-up faucet (scripts/gate-faucet.mjs). Empty = disabled.
  VITE_GATE_FAUCET_URL: z.string().optional().default(''),
})

export type Env = z.infer<typeof envSchema>

function getEnv(): Env {
  const raw = {
    VITE_WALLETCONNECT_PROJECT_ID: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
    VITE_XMTP_ENV: import.meta.env.VITE_XMTP_ENV,
    VITE_APP_URL: normalizeViteAppUrl(String(import.meta.env.VITE_APP_URL ?? '')),
    VITE_GUN_RELAY_PEERS: import.meta.env.VITE_GUN_RELAY_PEERS || undefined,
    VITE_SLIDING_WINDOW_MINUTES: import.meta.env.VITE_SLIDING_WINDOW_MINUTES || undefined,
    VITE_ARKIV_RPC_URL: import.meta.env.VITE_ARKIV_RPC_URL || undefined,
    VITE_SEPOLIA_RPC_URL: import.meta.env.VITE_SEPOLIA_RPC_URL || undefined,
    VITE_GATE_FAUCET_URL: import.meta.env.VITE_GATE_FAUCET_URL || undefined,
  }

  const result = envSchema.safeParse(raw)

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ❌ ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')

    throw new Error(
      `Environment validation failed:\n${formatted}\n\nCheck your .env.local file against .env.local.example.`,
    )
  }

  return result.data
}

/** Validated environment variables — parsed at import time */
export const env = getEnv()
