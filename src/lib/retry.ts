/**
 * Generic retry utility with exponential backoff.
 */

export interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  shouldRetry?: (error: Error) => boolean
  onRetry?: (error: Error, attempt: number, delayMs: number) => void
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10_000,
    shouldRetry = () => true,
    onRetry,
  } = options

  let lastError: Error | undefined
  let delay = baseDelayMs

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt === maxRetries || !shouldRetry(lastError)) break
      onRetry?.(lastError, attempt + 1, delay)
      await new Promise((r) => setTimeout(r, delay))
      delay = Math.min(delay * 2, maxDelayMs)
    }
  }

  throw lastError
}
