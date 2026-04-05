import { hexToBytes, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { IdentifierKind, type Signer } from '@xmtp/node-sdk'

/**
 * Build an XMTP EOA signer from a secp256k1 private key (hex).
 * The account address becomes the XMTP identifier.
 */
export function createXmtpEoaSigner(privateKey: Hex): Signer {
  const account = privateKeyToAccount(privateKey)
  return {
    type: 'EOA',
    getIdentifier: () => ({
      identifier: account.address.toLowerCase(),
      identifierKind: IdentifierKind.Ethereum,
    }),
    signMessage: async (message: string) => {
      const sig = await account.signMessage({ message })
      return hexToBytes(sig)
    },
  }
}
