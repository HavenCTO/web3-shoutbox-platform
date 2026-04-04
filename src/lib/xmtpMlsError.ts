import { XMTP_MLS_SYNC_LIKELY_CODE } from '@/types/errors'

/**
 * True when the SDK / WASM surface reports secret reuse (duplicate processing
 * of the same MLS secret material). Useful to flag in logs when opening SDK issues.
 */
export function isLikelySecretReuseError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('secretreuse') ||
    m.includes('secret reuse') ||
    m.includes('reuse error') ||
    // OpenMLS / XMTP WASM: app message key generation invalid — often logged with SecretReuseError
    m.includes('ciphertext generation out of bounds')
  )
}

/**
 * Heuristic detection for XMTP / OpenMLS sync and decrypt failures worth a client+group resync.
 * Messages vary by SDK version; we match stable substrings.
 */
export function isLikelyXmtpMlsOrDecryptError(message: string): boolean {
  const m = message.toLowerCase()
  if (isLikelySecretReuseError(message)) return true
  if (m.includes('forward secrecy')) return true
  if (m.includes('decrypt')) return true
  if (m.includes('openmls')) return true
  if (m.includes('open mls')) return true
  if (/\bmls\b/.test(m)) return true
  if (m.includes('secret')) return true
  return false
}

/** Maps SDK error text to a stable code when a resync may help. */
export function resolveXmtpMessagingErrorCode(message: string, fallbackCode: string): string {
  return isLikelyXmtpMlsOrDecryptError(message) ? XMTP_MLS_SYNC_LIKELY_CODE : fallbackCode
}
