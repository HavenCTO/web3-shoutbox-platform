/**
 * Messaging Service
 *
 * Thin service layer over the XMTP lib with retry logic for resilience.
 * All fallible operations return Result<T, MessagingError>.
 */

import type { Signer } from '@xmtp/browser-sdk'
import { IdentifierKind } from '@xmtp/browser-sdk'
import type { Group } from '@xmtp/browser-sdk'
import {
  createXmtpClient,
  getInboxId as libGetInboxId,
  canMessage as libCanMessage,
  type XmtpClient,
} from '@/lib/xmtp'
import { MessagingError } from '@/types/errors'
import {
  isUserRejection,
  isRateLimitError,
  isTransientError,
  isGroupFullError,
  isMemberAlreadyAddedError,
} from '@/types/errors'
import { resolveXmtpMessagingErrorCode } from '@/lib/xmtpMlsError'
import { tryEmitXmtpMlsDiagnostic } from '@/lib/xmtpMlsDiagnostics'
import { type Result, ok, err } from '@/types/result'
import type { ShoutboxMessage } from '@/types/message'
import { retryWithBackoff } from '@/lib/retry'

// Re-export Group type for consumers
export type XmtpGroup = Group

/**
 * Initializes an XMTP client from a wallet signer.
 * Retries on transient failures but NOT on user rejection.
 */
export async function initializeXmtpClient(
  signer: Signer,
): Promise<Result<XmtpClient, MessagingError>> {
  try {
    const client = await retryWithBackoff(() => createXmtpClient(signer), {
      maxRetries: 2,
      baseDelayMs: 1500,
      shouldRetry: (e) => !isUserRejection(e) && isTransientError(e),
    })
    return ok(client)
  } catch (error) {
    return err(
      error instanceof MessagingError
        ? error
        : new MessagingError(
            `Unexpected error initializing XMTP: ${error instanceof Error ? error.message : String(error)}`,
            isUserRejection(error) ? 'XMTP_USER_REJECTED' : 'XMTP_INIT_UNEXPECTED',
          ),
    )
  }
}

/**
 * Returns the Inbox ID string from an initialized client.
 */
export function getInboxId(client: XmtpClient): string | undefined {
  return libGetInboxId(client)
}

/**
 * Checks if a wallet address can receive XMTP messages.
 */
export async function canMessage(
  client: XmtpClient,
  address: string,
): Promise<Result<boolean, MessagingError>> {
  try {
    const result = await libCanMessage(client, address)
    return ok(result)
  } catch (error) {
    return err(
      error instanceof MessagingError
        ? error
        : new MessagingError(
            `Unexpected error checking message capability: ${error instanceof Error ? error.message : String(error)}`,
            'XMTP_CAN_MESSAGE_UNEXPECTED',
          ),
    )
  }
}

function wrapError(error: unknown, fallbackCode: string): MessagingError {
  let wrapped: MessagingError
  if (error instanceof MessagingError) {
    const code = resolveXmtpMessagingErrorCode(error.message, error.code)
    wrapped = code === error.code ? error : new MessagingError(error.message, code)
  } else if (isRateLimitError(error)) {
    wrapped = new MessagingError(
      'Rate limit exceeded. Please wait before retrying.',
      'XMTP_RATE_LIMIT',
    )
  } else {
    const message = error instanceof Error ? error.message : String(error)
    wrapped = new MessagingError(message, resolveXmtpMessagingErrorCode(message, fallbackCode))
  }
  tryEmitXmtpMlsDiagnostic({
    operation: fallbackCode,
    error,
    message: wrapped.message,
    resolvedCode: wrapped.code,
    extras: { wrapFallbackCode: fallbackCode },
  })
  return wrapped
}

/**
 * Creates a new XMTP group conversation with the given wallet addresses.
 * Retries on transient failures; waits longer on rate limits.
 */
export async function createGroup(
  client: XmtpClient,
  memberAddresses: string[],
): Promise<Result<Group, MessagingError>> {
  try {
    const group = await retryWithBackoff(
      async () => {
        const identifiers = memberAddresses.map((addr) => ({
          identifier: addr.toLowerCase(),
          identifierKind: IdentifierKind.Ethereum,
        }))
        return client.conversations.createGroupWithIdentifiers(identifiers)
      },
      {
        maxRetries: 2,
        baseDelayMs: 2000,
        maxDelayMs: 15_000,
        shouldRetry: (e) => isTransientError(e) || isRateLimitError(e),
      },
    )
    return ok(group)
  } catch (error) {
    return err(wrapError(error, 'XMTP_CREATE_GROUP_FAILED'))
  }
}

/**
 * Adds members to an existing group (append-only).
 * Retries on transient failures; skips if member already added; respects group cap.
 */
export async function addMembersToGroup(
  group: Group,
  addresses: string[],
): Promise<Result<void, MessagingError>> {
  try {
    await retryWithBackoff(
      async () => {
        const identifiers = addresses.map((addr) => ({
          identifier: addr.toLowerCase(),
          identifierKind: IdentifierKind.Ethereum,
        }))
        await group.addMembersByIdentifiers(identifiers)
      },
      {
        maxRetries: 2,
        baseDelayMs: 1000,
        shouldRetry: (e) => {
          if (isMemberAlreadyAddedError(e)) return false
          if (isGroupFullError(e)) return false
          return isTransientError(e) || isRateLimitError(e)
        },
      },
    )
    return ok(undefined)
  } catch (error) {
    if (isMemberAlreadyAddedError(error)) return ok(undefined)
    if (isGroupFullError(error)) {
      return err(new MessagingError(
        'Room is full. A new session will start soon.',
        'XMTP_GROUP_FULL',
      ))
    }
    return err(wrapError(error, 'XMTP_ADD_MEMBERS_FAILED'))
  }
}

/**
 * Sends a text message to a group.
 * Retries once on failure, then surfaces the error.
 */
export async function sendMessage(
  group: Group,
  textContent: string,
): Promise<Result<void, MessagingError>> {
  try {
    await retryWithBackoff(() => group.sendText(textContent), {
      maxRetries: 1,
      baseDelayMs: 500,
      shouldRetry: (e) => isTransientError(e),
    })
    return ok(undefined)
  } catch (error) {
    return err(wrapError(error, 'XMTP_SEND_MESSAGE_FAILED'))
  }
}

/**
 * Maps an XMTP DecodedMessage to our ShoutboxMessage type.
 */
function toShoutboxMessage(msg: {
  id: string
  senderInboxId: string
  content: unknown
  sentAt: Date
  conversationId: string
}): ShoutboxMessage {
  return {
    id: msg.id,
    senderInboxId: msg.senderInboxId,
    senderAddress: '', // Resolved at display layer via inbox-to-address mapping
    content: typeof msg.content === 'string' ? msg.content : String(msg.content ?? ''),
    timestamp: msg.sentAt.getTime(),
    groupId: msg.conversationId,
  }
}

/**
 * Fetches existing messages from a group.
 */
export async function getGroupMessages(
  group: Group,
): Promise<Result<ShoutboxMessage[], MessagingError>> {
  try {
    const messages = await group.messages()
    const mapped = messages
      .filter((m) => typeof m.content === 'string')
      .map(toShoutboxMessage)
    return ok(mapped)
  } catch (error) {
    return err(wrapError(error, 'XMTP_GET_MESSAGES_FAILED'))
  }
}

/**
 * Subscribes to real-time incoming messages on a group.
 * Returns an unsubscribe function.
 *
 * **Single consumer:** only one active stream per `Group` should be used; call `unsubscribe`
 * before opening another (the hook does this on `groupId` change).
 *
 * **Sync vs stream:** `disableSync: true` avoids the SDK running a network sync immediately
 * before the stream starts, which can race with app-level `sync` + history loads and contribute
 * to duplicate MLS work / `SecretReuseError`-class failures. The app already syncs before
 * attaching the stream (`syncGroupForMessaging`, `getGroupMessages`, then this call).
 *
 * **Restarts:** the SDK may retry or restart the stream after transport failures; this layer
 * dedupes by XMTP message `id` so the same logical message is not processed twice for UI state.
 */
export function streamGroupMessages(
  group: Group,
  callback: (msg: ShoutboxMessage) => void,
): { unsubscribe: () => void } {
  let ended = false
  let endStream: (() => void) | null = null
  const seenMessageIds = new Set<string>()

  const start = async () => {
    try {
      const stream = await group.stream({
        disableSync: true,
        onError: (error) => {
          console.warn('[shoutbox] stream error:', error.message)
          tryEmitXmtpMlsDiagnostic({
            operation: 'stream.onError',
            error,
            message: error.message,
            groupId: group.id,
            extras: { streamDisableSync: true },
          })
        },
        onFail: () => {
          console.warn('[shoutbox] stream failed (SDK may retry/restart)')
        },
      })
      ;(async () => {
        for await (const message of stream) {
          if (ended) break
          if (typeof message.content === 'string') {
            const mapped = toShoutboxMessage(message)
            if (seenMessageIds.has(mapped.id)) continue
            seenMessageIds.add(mapped.id)
            callback(mapped)
          }
        }
      })()
      endStream = () => stream.end()
    } catch (error) {
      console.error('[shoutbox] stream start failed:', error)
      const message = error instanceof Error ? error.message : String(error)
      tryEmitXmtpMlsDiagnostic({
        operation: 'stream.start',
        error,
        message,
        groupId: group.id,
        extras: { streamDisableSync: true },
      })
    }
  }

  void start()

  return {
    unsubscribe: () => {
      ended = true
      endStream?.()
    },
  }
}
