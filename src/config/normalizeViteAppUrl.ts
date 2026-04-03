/**
 * Normalizes VITE_APP_URL so it passes URL validation.
 * Zod's .url() requires a scheme; deploy secrets often omit it (e.g. `example.com`).
 */

export function normalizeViteAppUrl(value: string): string {
  const trimmed = value.trim()
  if (trimmed === '') {
    return ''
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return trimmed
  }

  const lower = trimmed.toLowerCase()
  if (lower.startsWith('localhost') || lower.startsWith('127.0.0.1')) {
    return `http://${trimmed}`
  }

  return `https://${trimmed}`
}
