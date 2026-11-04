import { getOrCreateEphemeralIdentity } from '@/lib/ephemeral-identity'

export interface GuestWallet {
  account: { address: string }
  signTypedData: (args: {
    domain: Record<string, unknown>
    types: Record<string, unknown[]>
    primaryType: string
    message: Record<string, unknown>
  }) => Promise<string>
}

/** The shoutbox guest identity as a Haven-AOL wallet: it already holds a
 *  local key, so gate requests sign silently — no wallet prompt, ever. */
export function getGuestWallet(): GuestWallet {
  const { account } = getOrCreateEphemeralIdentity()
  return {
    account: { address: account.address },
    signTypedData: async (args) =>
      // viem's typed-data shape is the wagmi shape Haven-AOL builds.
      account.signTypedData(args as Parameters<typeof account.signTypedData>[0]),
  }
}

export function randomGateNonce(): bigint {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return BigInt(`0x${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`)
}
