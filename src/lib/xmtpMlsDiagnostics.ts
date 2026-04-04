import {
  MessagingError,
  getErrorMessage,
  XMTP_MLS_SYNC_LIKELY_CODE,
} from '@/types/errors'
import {
  isLikelySecretReuseError,
  isLikelyXmtpMlsOrDecryptError,
} from '@/lib/xmtpMlsError'
import {
  XMTP_BROWSER_SDK_ISSUES_URL,
  XMTP_BROWSER_SDK_VERSION,
} from '@/lib/xmtpBrowserSdkPackageMeta'

const DIAGNOSTIC_TAG = 'xmtp-mls-diagnostics-v1' as const
const MAX_STACK_PREVIEW_CHARS = 2_000

export interface SerializedErrorForDiagnostics {
  name: string
  message: string
  stackPreview: string | null
  code: string | null
  causePreview: string | null
}

export interface XmtpMlsDiagnosticRecord {
  readonly tag: typeof DIAGNOSTIC_TAG
  readonly timestampIso: string
  readonly operation: string
  readonly message: string
  readonly resolvedCode: string | null
  readonly secretReuseLikely: boolean
  readonly mlsOrDecryptLikely: boolean
  readonly groupId: string | null
  readonly inboxId: string | null
  readonly sdk: { readonly name: '@xmtp/browser-sdk'; readonly version: string }
  readonly suggestedIssueUrl: string
  readonly runtime: {
    readonly xmtpEnv: string | undefined
    readonly userAgent: string
    readonly language: string
  }
  readonly error: SerializedErrorForDiagnostics
  readonly extras: Readonly<Record<string, string | number | boolean | null>> | null
}

/** Dev server, or production when `VITE_XMTP_MLS_DIAGNOSTICS=true`. */
export function shouldEmitXmtpMlsDiagnostics(): boolean {
  return (
    Boolean(import.meta.env.DEV) ||
    import.meta.env.VITE_XMTP_MLS_DIAGNOSTICS === 'true'
  )
}

function truncateStack(stack: string): string {
  if (stack.length <= MAX_STACK_PREVIEW_CHARS) return stack
  return `${stack.slice(0, MAX_STACK_PREVIEW_CHARS)}…[truncated]`
}

export function serializeErrorForDiagnostics(error: unknown): SerializedErrorForDiagnostics {
  if (error instanceof MessagingError) {
    return {
      name: error.name,
      message: error.message,
      stackPreview: error.stack ? truncateStack(error.stack) : null,
      code: error.code,
      causePreview: serializeCause(error.cause),
    }
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stackPreview: error.stack ? truncateStack(error.stack) : null,
      code: null,
      causePreview: serializeCause(error.cause),
    }
  }
  return {
    name: 'NonError',
    message: getErrorMessage(error),
    stackPreview: null,
    code: null,
    causePreview: null,
  }
}

function serializeCause(cause: unknown): string | null {
  if (cause === undefined || cause === null) return null
  if (cause instanceof Error) {
    const piece = `${cause.name}: ${cause.message}`
    return piece.length > 500 ? `${piece.slice(0, 500)}…` : piece
  }
  const s = String(cause)
  return s.length > 500 ? `${s.slice(0, 500)}…` : s
}

function qualifiesForMlsDiagnostic(
  message: string,
  resolvedCode: string | null | undefined,
): boolean {
  if (isLikelySecretReuseError(message)) return true
  if (isLikelyXmtpMlsOrDecryptError(message)) return true
  if (resolvedCode === XMTP_MLS_SYNC_LIKELY_CODE) return true
  return false
}

export interface BuildXmtpMlsDiagnosticRecordInput {
  operation: string
  message: string
  resolvedCode?: string | null
  error: unknown
  groupId?: string | null
  inboxId?: string | null
  extras?: Readonly<Record<string, string | number | boolean | null | undefined>>
}

function normalizeExtras(
  extras: BuildXmtpMlsDiagnosticRecordInput['extras'],
): Readonly<Record<string, string | number | boolean | null>> | null {
  if (!extras) return null
  const out: Record<string, string | number | boolean | null> = {}
  for (const [k, v] of Object.entries(extras)) {
    if (v === undefined) continue
    out[k] = v
  }
  return Object.keys(out).length > 0 ? out : null
}

/**
 * Builds a single JSON-serializable record for pasting into an XMTP SDK issue.
 * Returns null when the message is not MLS / decrypt / secret-reuse related.
 */
export function buildXmtpMlsDiagnosticRecord(
  input: BuildXmtpMlsDiagnosticRecordInput,
): XmtpMlsDiagnosticRecord | null {
  const resolved = input.resolvedCode ?? null
  if (!qualifiesForMlsDiagnostic(input.message, resolved)) return null

  const secretReuseLikely = isLikelySecretReuseError(input.message)
  const mlsOrDecryptLikely = isLikelyXmtpMlsOrDecryptError(input.message)

  return {
    tag: DIAGNOSTIC_TAG,
    timestampIso: new Date().toISOString(),
    operation: input.operation,
    message: input.message,
    resolvedCode: resolved,
    secretReuseLikely,
    mlsOrDecryptLikely,
    groupId: input.groupId ?? null,
    inboxId: input.inboxId ?? null,
    sdk: { name: '@xmtp/browser-sdk', version: XMTP_BROWSER_SDK_VERSION },
    suggestedIssueUrl: XMTP_BROWSER_SDK_ISSUES_URL,
    runtime: {
      xmtpEnv: import.meta.env.VITE_XMTP_ENV,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      language: typeof navigator !== 'undefined' ? navigator.language : '',
    },
    error: serializeErrorForDiagnostics(input.error),
    extras: normalizeExtras(input.extras),
  }
}

/**
 * Emits one-line JSON to the console when diagnostics are enabled and the error
 * matches MLS / decrypt / `SecretReuseError` heuristics.
 */
export function tryEmitXmtpMlsDiagnostic(input: BuildXmtpMlsDiagnosticRecordInput): void {
  if (!shouldEmitXmtpMlsDiagnostics()) return
  const record = buildXmtpMlsDiagnosticRecord(input)
  if (!record) return
  console.warn(`[${DIAGNOSTIC_TAG}]`, JSON.stringify(record))
}
