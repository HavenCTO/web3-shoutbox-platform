/**
 * Ephemeral (guest) identity.
 *
 * A random keypair is generated on first visit and persisted in
 * localStorage, so anyone can chat immediately with no wallet, no
 * onboarding, and no signature prompts — signing happens locally and
 * silently. The key must never hold funds; it is a chat identity only.
 * Clearing browser storage (or `clearEphemeralIdentity`) starts fresh.
 */
import { toBytes } from 'viem'
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { IdentifierKind, type Signer } from '@xmtp/browser-sdk'

export const EPHEMERAL_KEY_STORAGE_KEY = 'shoutbox:ephemeral-private-key'

const PRIVATE_KEY_RE = /^0x[0-9a-fA-F]{64}$/

export interface EphemeralIdentity {
  address: string
  privateKey: `0x${string}`
  account: PrivateKeyAccount
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

let memoryPrivateKey: `0x${string}` | null = null

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

function readStoredKey(storage: StorageLike | null): `0x${string}` | null {
  try {
    const raw = storage?.getItem(EPHEMERAL_KEY_STORAGE_KEY)
    return raw && PRIVATE_KEY_RE.test(raw) ? (raw as `0x${string}`) : null
  } catch {
    return null
  }
}

/** Returns the persisted identity, generating and storing one on first use. */
export function getOrCreateEphemeralIdentity(storage?: StorageLike | null): EphemeralIdentity {
  const store = storage === undefined ? defaultStorage() : storage
  // An explicit store is authoritative (a corrupt stored key must be replaced);
  // the in-memory key is only a fallback when no storage exists at all.
  let privateKey = store ? readStoredKey(store) : memoryPrivateKey
  if (!privateKey || !PRIVATE_KEY_RE.test(privateKey)) {
    privateKey = generatePrivateKey()
    memoryPrivateKey = privateKey
    try {
      store?.setItem(EPHEMERAL_KEY_STORAGE_KEY, privateKey)
    } catch {
      // Storage unavailable (e.g. strict privacy mode) — keep the in-memory key for this session.
    }
  }
  const account = privateKeyToAccount(privateKey)
  return { address: account.address, privateKey, account }
}

/** Drops the stored identity. The next call creates a brand-new person. */
export function clearEphemeralIdentity(storage?: StorageLike | null): void {
  memoryPrivateKey = null
  const store = storage === undefined ? defaultStorage() : storage
  try {
    store?.removeItem(EPHEMERAL_KEY_STORAGE_KEY)
  } catch {
    // Nothing else to do — the in-memory key is already cleared.
  }
}

/** XMTP signer backed by the local key: every signature is automatic and invisible. */
export function createEphemeralSigner(identity: EphemeralIdentity): Signer {
  const { account } = identity
  return {
    type: 'EOA' as const,
    getIdentifier: () => ({
      identifier: account.address.toLowerCase(),
      identifierKind: IdentifierKind.Ethereum,
    }),
    signMessage: async (message: string) => {
      const sig = await account.signMessage({ message })
      return toBytes(sig)
    },
  }
}
