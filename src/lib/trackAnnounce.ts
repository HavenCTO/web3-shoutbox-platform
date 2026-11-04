/**
 * Parse a Herald release announcement (plain XMTP text) into a track ref.
 * Announcements carry, in prose: a title, an Arkiv entity key
 * (0x + 64 hex), and a Filecoin locator — a CommP piece CID (`bafkz…`,
 * gated) or a clear `fcid` (`bafkr…`/`bafy…`, free). Anything else in
 * chat is not a track and must render as plain text.
 */
export interface TrackRef {
  arkivKey: string | null
  pieceCid: string | null
  filecoinCid: string | null
  title: string
}

const ARKIV_KEY_RE = /0x[0-9a-fA-F]{64}/
const PIECE_CID_RE = /bafkzcib[0-9a-z]{20,}/
const FCID_RE = /baf[ky][0-9a-z]{20,}/

export function parseTrackAnnounce(content: string): TrackRef | null {
  if (!content) return null
  const arkivKey = content.match(ARKIV_KEY_RE)?.[0]?.toLowerCase() ?? null
  const pieceCid = content.match(PIECE_CID_RE)?.[0] ?? null
  const fcidMatch = content.match(FCID_RE)?.[0] ?? null
  const filecoinCid = fcidMatch && fcidMatch !== pieceCid ? fcidMatch : null
  if (!arkivKey && !pieceCid) return null
  // Require a release-ish signal so tx hashes / random CIDs in chat don't render as tracks.
  if (!/arkiv|piece|fcid|cid|release|free|gated|track|album/i.test(content)) return null
  const firstLine = content.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? 'Untitled'
  const title = firstLine.replace(/^[#>*\-\s]+/, '').slice(0, 120) || 'Untitled'
  return { arkivKey, pieceCid, filecoinCid, title }
}
