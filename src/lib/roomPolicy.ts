/**
 * Single-room policy.
 *
 * A shoutbox deployment serves the rooms the operator listed in
 * `VITE_ALLOWED_ROOMS` and no others. Left alone, room URLs arrive from
 * user input at three separate places — the `?room=` query parameter, the
 * room browser's free-text join form, and the embedding page's
 * `document.referrer` — which is how one deployment ended up scattered
 * across hundreds of sliding-window XMTP groups.
 *
 * Every one of those entry points resolves through here instead, and the
 * room that survives is stamped into the XMTP group's name when the leader
 * creates it (see `messagingService.createGroup`). The bridge repeats the
 * same check server-side against `[shoutbox].allowed_rooms`, so a group
 * this policy never saw is still refused there.
 *
 * The group name is a policy hook, not a security boundary: XMTP group
 * names are unsigned, so anyone can name a group whatever they like. This
 * stops rooms being created by accident; it does not stop a determined
 * stranger adding the bridge's address to a group of their own.
 */

import { env } from '@/config/env'
import { normalizeUrl } from '@/lib/url-utils'

/** Where any unrecognized room URL lands. */
const FALLBACK_ROOM = 'https://shoutbox.pinme.dev/default'

/** `VITE_ALLOWED_ROOMS` entry that turns the restriction off entirely. */
const WILDCARD = '*'

/** True when the deployment serves every URL rather than a fixed list. */
export const ALLOW_ALL: boolean = env.VITE_ALLOWED_ROOMS.split(',').some((entry) => entry.trim() === WILDCARD)

/**
 * Normalized rooms this deployment serves. Empty when {@link ALLOW_ALL},
 * never empty otherwise.
 */
export const ALLOWED_ROOMS: readonly string[] = ALLOW_ALL ? [] : parseAllowedRooms(env.VITE_ALLOWED_ROOMS)

/** The room an unrecognized request lands in. */
export const DEFAULT_ROOM: string = ALLOWED_ROOMS[0] ?? FALLBACK_ROOM

function parseAllowedRooms(raw: string): string[] {
  const rooms: string[] = []
  for (const entry of raw.split(',').map((value) => value.trim()).filter(Boolean)) {
    let normalized: string
    try {
      normalized = normalizeUrl(entry)
    } catch {
      console.warn(`[shoutbox] ignoring invalid room in VITE_ALLOWED_ROOMS: ${entry}`)
      continue
    }
    if (!rooms.includes(normalized)) rooms.push(normalized)
  }
  return rooms.length > 0 ? rooms : [FALLBACK_ROOM]
}

/** True when `raw` names a room this deployment serves. Never throws. */
export function isRoomAllowed(raw: string | null | undefined): boolean {
  if (!raw) return false
  try {
    const normalized = normalizeUrl(raw.trim())
    return ALLOW_ALL || ALLOWED_ROOMS.includes(normalized)
  } catch {
    return false
  }
}

/**
 * The room to open for a requested URL: the request itself when it is
 * allowed, {@link DEFAULT_ROOM} otherwise. Takes raw user input, so it
 * never throws — an unparseable URL is simply not an allowed room.
 */
export function resolveRoom(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_ROOM
  try {
    const normalized = normalizeUrl(raw.trim())
    return isRoomAllowed(normalized) ? normalized : DEFAULT_ROOM
  } catch {
    return DEFAULT_ROOM
  }
}

/** Human-readable label for a room URL, for lists and headings. */
export function roomLabel(raw: string): string {
  try {
    const { hostname, pathname } = new URL(raw)
    const segment = pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop()
    return segment ? segment.replace(/[-_]+/g, ' ') : hostname
  } catch {
    return raw
  }
}
