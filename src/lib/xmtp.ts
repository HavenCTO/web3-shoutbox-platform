/**
 * XMTP Client Factory & Utilities
 *
 * Low-level XMTP client lifecycle management.
 * Creates clients from wallet signers, resolves Inbox IDs, and checks reachability.
 */

import { Client, IdentifierKind } from '@xmtp/browser-sdk'
import type { Signer, NetworkOptions, DeviceSyncOptions, StorageOptions, OtherOptions } from '@xmtp/browser-sdk'
import { env } from '@/config/env'
import { MessagingError } from '@/types/errors'

export type { Signer as XmtpSigner } from '@xmtp/browser-sdk'
export type XmtpClient = Client

/** Options type matching the NetworkOptions branch of ClientOptions */
type XmtpClientOptions = NetworkOptions & DeviceSyncOptions & StorageOptions & OtherOptions

/**
 * Creates an XMTP client from a wallet signer.
 *
 * On first use, the user will see a wallet signature prompt for Inbox ID registration.
 * This is expected XMTP behavior for one-time identity creation.
 *
 * @throws {MessagingError} if client creation fails
 */
export async function createXmtpClient(signer: Signer): Promise<Client> {
  try {
    const options: XmtpClientOptions = {
      env: env.VITE_XMTP_ENV,
    }
    return await Client.create(signer, options)
  } catch (error) {
    throw new MessagingError(
      `Failed to initialize XMTP client: ${error instanceof Error ? error.message : String(error)}`,
      'XMTP_CLIENT_INIT_FAILED',
    )
  }
}

/**
 * Returns the Inbox ID from an initialized XMTP client.
 */
export function getInboxId(client: Client): string | undefined {
  return client.inboxId
}

/**
 * Checks whether a wallet address is registered on XMTP and can receive messages.
 *
 * @throws {MessagingError} if the check fails
 */
export async function canMessage(client: Client, address: string): Promise<boolean> {
  try {
    const results = await client.canMessage([
      { identifier: address.toLowerCase(), identifierKind: IdentifierKind.Ethereum },
    ])
    return results.get(address.toLowerCase()) ?? false
  } catch (error) {
    throw new MessagingError(
      `Failed to check messaging capability: ${error instanceof Error ? error.message : String(error)}`,
      'XMTP_CAN_MESSAGE_FAILED',
    )
  }
}
