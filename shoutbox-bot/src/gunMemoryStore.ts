/**
 * In-memory Gun `opt.store` (same shape as `gun/lib/rfs`) so Node never touches `./radata`.
 * Radisk calls put/get/list against this when enabled; avoids Windows EPERM on fs.rename.
 */

export interface GunMemoryStore {
  put: (
    file: string,
    data: string,
    cb: (err: Error | null | undefined, ok?: number) => void,
  ) => void
  get: (
    file: string,
    cb: (err: Error | null | undefined, data?: string) => void,
  ) => void
  list: (
    cb: (file: string) => void,
    match?: unknown,
    params?: unknown,
    cbs?: unknown,
  ) => void
}

export function createShoutboxGunMemoryStore(): GunMemoryStore {
  const files = new Map<string, string>()
  return {
    put(file, data, cb) {
      files.set(file, data)
      queueMicrotask(() => {
        cb(null, 1)
      })
    },
    get(file, cb) {
      queueMicrotask(() => {
        const data = files.get(file)
        if (data === undefined) {
          cb()
          return
        }
        cb(null, data)
      })
    },
    list(cb) {
      for (const k of files.keys()) {
        cb(k)
      }
      cb()
    },
  }
}
