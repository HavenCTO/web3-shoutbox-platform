export class MessagingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'MessagingError'
  }
}

export class PresenceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'PresenceError'
  }
}

export class GroupLifecycleError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'GroupLifecycleError'
  }
}

export class EmbedError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'EmbedError'
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/** Returns true if the error is a user-initiated rejection (wallet signature denied, etc.) */
export function isUserRejection(error: unknown): boolean {
  const msg = getErrorMessage(error).toLowerCase()
  return (
    msg.includes('user rejected') ||
    msg.includes('user denied') ||
    msg.includes('user cancelled') ||
    msg.includes('rejected the request') ||
    msg.includes('action_rejected')
  )
}

/** Returns true if the error indicates an XMTP rate limit */
export function isRateLimitError(error: unknown): boolean {
  const msg = getErrorMessage(error).toLowerCase()
  return msg.includes('rate limit') || msg.includes('429') || msg.includes('too many requests')
}

/** Returns true if the error is a transient network issue worth retrying */
export function isTransientError(error: unknown): boolean {
  if (isUserRejection(error)) return false
  if (isRateLimitError(error)) return true
  const msg = getErrorMessage(error).toLowerCase()
  return (
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('econnrefused') ||
    msg.includes('fetch') ||
    msg.includes('failed to fetch') ||
    msg.includes('socket') ||
    msg.includes('503') ||
    msg.includes('502')
  )
}

/** Returns true if the error indicates WASM/OPFS/IndexedDB browser compatibility issues */
export function isBrowserCompatError(error: unknown): boolean {
  const msg = getErrorMessage(error).toLowerCase()
  return (
    msg.includes('wasm') ||
    msg.includes('opfs') ||
    msg.includes('indexeddb') ||
    msg.includes('storage access') ||
    msg.includes('securityerror') ||
    msg.includes('the request is not allowed')
  )
}

/** Returns true if the error indicates the XMTP group is full (250 members) */
export function isGroupFullError(error: unknown): boolean {
  const msg = getErrorMessage(error).toLowerCase()
  return msg.includes('maximum') || msg.includes('group is full') || msg.includes('250')
}

/** Returns true if the error indicates too many XMTP installations (10 limit) */
export function isInstallationLimitError(error: unknown): boolean {
  const msg = getErrorMessage(error).toLowerCase()
  return msg.includes('installation') && (msg.includes('limit') || msg.includes('maximum'))
}

/** Returns true if the member is already in the group */
export function isMemberAlreadyAddedError(error: unknown): boolean {
  const msg = getErrorMessage(error).toLowerCase()
  return msg.includes('already a member') || msg.includes('already in')
}
