/** Minimal Gun chain surface the bot uses under `shoutbox-v1`. */
export interface ShoutboxGunRef {
  get(key: string): ShoutboxGunRef
  put(value: unknown, cb?: (ack: { err?: unknown }) => void): ShoutboxGunRef
  on(callback: (data: unknown) => void): ShoutboxGunRef
  off(): ShoutboxGunRef
}
