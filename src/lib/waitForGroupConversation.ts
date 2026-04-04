import type { Client, Group } from '@xmtp/browser-sdk'

/** Tunable backoff while waiting for a group to appear locally after GunDB/coordinator state updates. */
export interface WaitForGroupConversationOptions {
  maxAttempts: number
  initialDelayMs: number
  maxDelayMs: number
}

export const DEFAULT_WAIT_FOR_GROUP_OPTIONS: WaitForGroupConversationOptions = {
  maxAttempts: 28,
  initialDelayMs: 350,
  maxDelayMs: 4500,
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Repeatedly syncs conversations and resolves the group until it exists locally or attempts are exhausted.
 * Used when GunDB advertises a group id before MLS welcome / sync has landed on this device.
 */
export async function waitForGroupConversation(
  client: Client,
  groupId: string,
  options: WaitForGroupConversationOptions,
  shouldCancel: () => boolean,
): Promise<Group | null> {
  let delayMs = options.initialDelayMs
  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    if (shouldCancel()) return null
    try {
      await client.conversations.sync()
    } catch {
      // Transient sync failures — still try a direct lookup.
    }
    if (shouldCancel()) return null
    const conversation = await client.conversations.getConversationById(groupId)
    if (conversation) return conversation as Group

    if (attempt < options.maxAttempts - 1) {
      await sleep(delayMs)
      delayMs = Math.min(Math.floor(delayMs * 1.55), options.maxDelayMs)
    }
  }
  return null
}
