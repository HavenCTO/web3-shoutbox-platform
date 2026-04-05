import { Client, type ClientOptions, type Signer, type XmtpEnv } from '@xmtp/node-sdk'
import type { Hex } from 'viem'
import { createXmtpEoaSigner } from './xmtpSigner.js'

export interface CreateShoutboxBotClientParams {
  privateKey: Hex
  env: XmtpEnv
  dbPath?: string | null
  dbEncryptionKey?: Uint8Array
}

/** Create a persisted XMTP client for the shoutbox bot wallet. */
export async function createShoutboxBotClient(
  params: CreateShoutboxBotClientParams,
): Promise<Client> {
  const signer: Signer = createXmtpEoaSigner(params.privateKey)
  const options: ClientOptions = {
    env: params.env,
    dbPath: params.dbPath,
    dbEncryptionKey: params.dbEncryptionKey,
  }
  return (await Client.create(signer, options)) as Client
}
