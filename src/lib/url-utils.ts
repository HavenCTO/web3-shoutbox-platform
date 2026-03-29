/**
 * URL normalization and hashing utilities for generating deterministic room keys.
 * Used by both the presence layer and group lifecycle layer.
 */

/** Normalize a URL: keep protocol + host + pathname, strip query/hash, lowercase host, remove trailing slash */
export function normalizeUrl(raw: string): string {
  const url = new URL(raw)
  const path = url.pathname.replace(/\/+$/, '') || ''
  return `${url.protocol}//${url.hostname.toLowerCase()}${path}`
}

/** Hash a normalized URL with SHA-256 to produce a hex room key */
export async function hashUrl(raw: string): Promise<string> {
  const normalized = normalizeUrl(raw)
  const data = new TextEncoder().encode(normalized)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
