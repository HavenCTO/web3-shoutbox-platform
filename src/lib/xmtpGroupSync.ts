import type { Group } from '@xmtp/browser-sdk'

/**
 * Pulls the latest MLS commits for this group before we read messages or allow send.
 * `getConversationById` can succeed before membership/welcome processing is complete locally.
 */
export async function syncGroupForMessaging(
  group: Pick<Group, 'sync'>,
  shouldCancel: () => boolean,
): Promise<boolean> {
  if (shouldCancel()) return false
  try {
    await group.sync()
  } catch {
    return false
  }
  return !shouldCancel()
}
