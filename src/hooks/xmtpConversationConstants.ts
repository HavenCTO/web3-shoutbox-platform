/** Upper bound for polling until MLS roster matches presence (aligned with poll interval × max attempts). */
export const MEMBER_SETTLE_MAX_WAIT_MS = 28_000

/** After MLS roster is stable, lets welcome side-effects and identity updates drain before we read history. */
export const POST_MEMBER_SETTLE_BUFFER_MS = 900

/**
 * After the message stream is attached, the worker may still be rotating key packages / flushing.
 * Enabling the composer before that finishes can produce sends that never reach peers until reload.
 */
export const READY_AFTER_STREAM_START_MS = 1400
