/** A decrypted plain-text line in the active group (chronological order, oldest first). */
export interface TextMessageRow {
  readonly id: string
  readonly senderInboxId: string
  readonly content: string
  readonly sentAtMs: number
}

/** Everything the reply layer needs to reason about the ~5-minute shoutbox window. */
export interface ShoutboxReplyContext {
  readonly memberInboxIds: readonly string[]
  readonly textMessages: readonly TextMessageRow[]
  readonly botInboxId: string
  readonly trigger: {
    readonly id: string
    readonly senderInboxId: string
    readonly content: string
    readonly sentAtMs: number
  }
}

/** Short stable label for an XMTP inbox id (not a human name). */
export function inboxPrefix(inboxId: string): string {
  const t = inboxId.trim()
  return t.length <= 8 ? t : t.slice(0, 8)
}

/**
 * Ensure the streamed trigger message is present (local DB may lag the stream by one tick).
 */
export function mergeTriggerIntoTranscript(
  rows: readonly TextMessageRow[],
  trigger: TextMessageRow,
): TextMessageRow[] {
  if (rows.some((r) => r.id === trigger.id)) {
    return [...rows]
  }
  return [...rows, trigger]
}
