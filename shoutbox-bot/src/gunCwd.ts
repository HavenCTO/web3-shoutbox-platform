import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export interface GunCwdDeps {
  tmpDir: () => string
  processId: number
  mkdirSyncFn: typeof mkdirSync
  existsSyncFn: typeof existsSync
  chdirFn: (dir: string) => void
}

const defaultDeps: GunCwdDeps = {
  tmpDir: tmpdir,
  processId: process.pid,
  mkdirSyncFn: mkdirSync,
  existsSyncFn: existsSync,
  chdirFn: (dir) => {
    process.chdir(dir)
  },
}

/** Temp isolate path (same as chdir target). Use for Gun `file` so rfs never uses repo-relative `radata`. */
export function gunIsolateDirectory(deps: GunCwdDeps = defaultDeps): string {
  return join(deps.tmpDir(), `shoutbox-bot-gun-${deps.processId}`)
}

/**
 * Move cwd to a per-process directory under the OS temp folder before Gun runs.
 * Gun/rfs defaults to ./radata under cwd; OneDrive/repo paths often cause EPERM on Windows rename().
 */
export function useEphemeralGunWorkingDirectory(deps: GunCwdDeps = defaultDeps): string {
  const dir = gunIsolateDirectory(deps)
  if (!deps.existsSyncFn(dir)) {
    deps.mkdirSyncFn(dir, { recursive: true })
  }
  deps.chdirFn(dir)
  return dir
}
