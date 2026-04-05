import type { ShoutboxReplyContext } from './shoutboxContext.js'

/** Default reply line shown in the shoutbox (uses only the triggering message text). */
export function formatShoutboxReply(ctx: ShoutboxReplyContext): string {
  const trimmed = ctx.trigger.content.trim()
  return `[bot] ${trimmed}`
}
