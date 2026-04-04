/**
 * Coalesces many rapid calls into at most one run per animation frame.
 * Use to avoid Zustand/React churn when upstream emits fine-grained events (e.g. Gun merges).
 */

export interface RafBatchScheduler {
  schedule: () => void
  cancel: () => void
}

export function createRafBatchScheduler(run: () => void): RafBatchScheduler {
  let id: number | null = null

  const flush = (): void => {
    id = null
    run()
  }

  return {
    schedule(): void {
      if (id !== null) return
      id = requestAnimationFrame(flush)
    },
    cancel(): void {
      if (id !== null) {
        cancelAnimationFrame(id)
        id = null
      }
    },
  }
}
