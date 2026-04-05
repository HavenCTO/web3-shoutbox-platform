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
  let tickCount = 0
  let lastAckOk = 0
  let lastAckErr = 0
  const tick = (): void => {
    tickCount++
    const now = opts.now()
    const payload: PresencePayload = {
      inboxId: opts.inboxId,
      address: opts.address,
      ts: now,
      status: 'online',
    }
    if (opts.log) {
      opts.log(`[shoutbox-bot] presence tick #${tickCount} ts=${now} path=shoutbox-v1/presence/${opts.roomKey.slice(0, 8)}…/${opts.inboxId.slice(0, 8)}…`)
    }
    ref.put(payload, (ack) => {
      if (ack?.err) {
        lastAckErr++
        if (opts.log) {
          opts.log(`[shoutbox-bot] Gun presence put ERROR #${lastAckErr}: ${formatGunPutErr(ack.err)}`)
        }
      } else {
        lastAckOk++
        // Log first few successes, then periodically every 6th (~ every minute)
        if (opts.log && (lastAckOk <= 3 || lastAckOk % 6 === 0)) {
          opts.log(`[shoutbox-bot] Gun presence put OK (ack #${lastAckOk}, errors so far: ${lastAckErr})`)
        }
      }
    })
  }
  tick()
  const id = opts.setIntervalFn(tick, opts.intervalMs)
  return () => {
    opts.clearIntervalFn(id)
  }
}
