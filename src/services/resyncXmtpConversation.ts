import type { Group } from '@xmtp/browser-sdk'
import type { XmtpClient } from '@/lib/xmtp'
import { tryEmitXmtpMlsDiagnostic } from '@/lib/xmtpMlsDiagnostics'
import { MessagingError } from '@/types/errors'
import { type Result, ok, err } from '@/types/result'

/**
 * Pulls latest conversation state from the network, then syncs the active group.
 * Use after MLS / decrypt errors to recover local epoch state.
 */
export async function resyncXmtpConversation(
  client: XmtpClient,
  group: Group,
): Promise<Result<void, MessagingError>> {
  try {
    await client.conversations.sync()
    await group.sync()
    return ok(undefined)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    tryEmitXmtpMlsDiagnostic({
      operation: 'resyncXmtpConversation',
      error,
      message,
      resolvedCode: error instanceof MessagingError ? error.code : 'XMTP_RESYNC_FAILED',
      groupId: group.id,
      extras: { step: 'client.conversations.sync_or_group.sync' },
    })
    return err(
      error instanceof MessagingError
        ? error
        : new MessagingError(message, 'XMTP_RESYNC_FAILED'),
    )
  }
}
