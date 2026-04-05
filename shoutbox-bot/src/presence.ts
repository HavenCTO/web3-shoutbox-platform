import { GUN_NAMESPACE } from './constants.js'
import type { ShoutboxGunRef } from './gunTypes.js'

function formatGunPutErr(err: unknown): string {
  if (typeof err === 'string') {
    return err
  }
  if (err instanceof Error) {
    return err.message
  }
  if (err !== null && typeof err === 'object') {
    try {
      return JSON.stringify(err)
    } catch {
      return String(err)
    }
  }
  return String(err)
}

export interface PresencePayload {
  inboxId: string
  address: string
  ts: number
  status: 'online'
}

export interface PresenceHeartbeatOpts {
  gun: ShoutboxGunRef
  roomKey: string
  inboxId: string
  address: string
  intervalMs: number
  now: () => number
  setIntervalFn: typeof globalThis.setInterval
  clearIntervalFn: typeof globalThis.clearInterval
  /** Logs Gun `put` ack errors (e.g. relay failures). */
  log?: (line: string) => void
}

/**
 * Heartbeat GunDB presence so the sliding-window leader can include this wallet
 * when creating the next XMTP group. Matches `presenceService` / `gun-presence` paths.
 */
export function startGunPresenceHeartbeat(opts: PresenceHeartbeatOpts): () => void {
  const ref = opts.gun.get(GUN_NAMESPACE).get('presence').get(opts.roomKey).get(opts.inboxId)
  const tick = (): void => {
    const payload: PresencePayload = {
      inboxId: opts.inboxId,
      address: opts.address,
      ts: opts.now(),
      status: 'online',
    }
    ref.put(payload, (ack) => {
      if (ack?.err && opts.log) {
        opts.log(`[shoutbox-bot] Gun presence put error: ${formatGunPutErr(ack.err)}`)
      }
    })
  }
  tick()
  const id = opts.setIntervalFn(tick, opts.intervalMs)
  return () => {
    opts.clearIntervalFn(id)
  }
}
