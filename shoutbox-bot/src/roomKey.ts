/**
 * Room key derivation — matches `src/lib/url-utils.ts` in the web app.
 */

/** Normalize URL for room identity (protocol + host + path, no query/hash, lowercase host, trim trailing slashes on path). */
export function normalizeUrl(raw: string): string {
  const url = new URL(raw)
  const path = url.pathname.replace(/\/+$/, '') || ''
  return `${url.protocol}//${url.hostname.toLowerCase()}${path}`
}

/** SHA-256 hex digest of the normalized URL (browser/Node Web Crypto). */
export async function hashUrl(raw: string): Promise<string> {
  const normalized = normalizeUrl(raw)
  const data = new TextEncoder().encode(normalized)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
