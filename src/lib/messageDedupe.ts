import type { ShoutboxMessage } from '@/types/message'

/**
 * Returns a copy of `msgs` with duplicate `id` values removed (first occurrence wins, order preserved).
 */
export function dedupeShoutboxMessagesById(msgs: readonly ShoutboxMessage[]): ShoutboxMessage[] {
  const seen = new Set<string>()
  const out: ShoutboxMessage[] = []
  for (const m of msgs) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    out.push(m)
  }
  return out
}
