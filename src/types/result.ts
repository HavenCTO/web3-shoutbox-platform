/**
 * Result Type Pattern
 *
 * A discriminated union for success/failure outcomes without throwing exceptions.
 */

export type Result<T, E = Error> =
  | { ok: true; data: T }
  | { ok: false; error: E }

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data }
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}

export async function tryCatch<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
  try {
    return ok(await fn())
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)))
  }
}

export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.data
  throw result.error
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.data : fallback
}
