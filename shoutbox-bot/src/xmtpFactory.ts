import {
  Client,
  type ClientOptions,
  type Signer,
  type XmtpEnv,
  createBackend,
  getInboxIdForIdentifier,
} from '@xmtp/node-sdk'
import type { Hex } from 'viem'
import { createXmtpEoaSigner } from './xmtpSigner.js'

export interface CreateShoutboxBotClientParams {
  privateKey: Hex
  env: XmtpEnv
  dbPath?: string | null
  dbEncryptionKey?: Uint8Array
}

/** Max installations an XMTP inbox supports. */
const MAX_INSTALLATIONS = 10

/**
 * Detect the "installation limit reached" error from XMTP.
 * The error message includes: "has already registered 10/10 installations"
 */
function isInstallationLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /registered\s+\d+\/\d+\s+installations/i.test(msg)
}

/**
 * Revoke all existing installations for the given signer/inbox so we can
 * register a fresh one.  Uses the static Client API which doesn't require
 * an active client instance.
 */
async function revokeAllInstallations(
  signer: Signer,
  env: XmtpEnv,
): Promise<void> {
  const backend = await createBackend({ env })
  const identifier = await signer.getIdentifier()

  // Resolve inboxId from the signer's on-chain identifier
  const inboxId = await getInboxIdForIdentifier(backend, identifier)
  if (!inboxId) {
    throw new Error(
      `[shoutbox-bot] Cannot resolve inboxId for ${identifier.identifier} — nothing to revoke`,
    )
  }

  // Fetch current inbox state to enumerate installations
  const [inboxState] = await Client.fetchInboxStates([inboxId], backend)
  if (!inboxState || inboxState.installations.length === 0) {
    console.log('[shoutbox-bot] No installations found to revoke')
    return
  }

  const installationIds = inboxState.installations.map((i) => i.bytes)
  console.log(
    `[shoutbox-bot] Revoking ${installationIds.length} existing installation(s) for inbox ${inboxId.slice(0, 12)}…`,
  )

  await Client.revokeInstallations(signer, inboxId, installationIds, backend)
  console.log('[shoutbox-bot] All old installations revoked successfully')
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

  try {
    return (await Client.create(signer, options)) as Client
  } catch (err) {
    if (!isInstallationLimitError(err)) {
      throw err
    }

    console.log(
      `[shoutbox-bot] Installation limit reached (${MAX_INSTALLATIONS}/${MAX_INSTALLATIONS}). Auto-revoking old installations…`,
    )

    await revokeAllInstallations(signer, params.env)

    // Retry client creation now that slots are free
    console.log('[shoutbox-bot] Retrying XMTP client creation…')
    return (await Client.create(signer, options)) as Client
  }
}
