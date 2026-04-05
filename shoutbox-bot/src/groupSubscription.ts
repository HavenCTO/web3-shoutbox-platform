import { GUN_NAMESPACE } from './constants.js'
import type { GroupWindow } from './groupWindow.js'
import { isActiveGroupWindow, parseGroupWindowFromGun } from './groupWindow.js'
import type { ShoutboxGunRef } from './gunTypes.js'

/**
 * Subscribe to the current XMTP group window for a room.
 * Calls `onWindow(null)` when data is missing or the window has expired.
 */
export function subscribeToGroupWindow(
  gun: ShoutboxGunRef,
  roomKey: string,
  onWindow: (gw: GroupWindow | null) => void,
  clock: { now: () => number },
): () => void {
  const ref = gun.get(GUN_NAMESPACE).get('groups').get(roomKey)
  const handler = (data: unknown) => {
    const parsed = parseGroupWindowFromGun(data)
    if (parsed === null || !isActiveGroupWindow(parsed, clock.now())) {
      onWindow(null)
      return
    }
    onWindow(parsed)
  }
  ref.on(handler)
  return () => {
    ref.off()
  }
}
