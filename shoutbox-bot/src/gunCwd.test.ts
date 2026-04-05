import { describe, it, expect, vi, afterAll } from 'vitest'
import {
  gunIsolateDirectory,
  useEphemeralGunWorkingDirectory,
  type GunCwdDeps,
} from './gunCwd.js'

describe('gunIsolateDirectory', () => {
  it('matches the path used by useEphemeralGunWorkingDirectory deps', () => {
    const deps: GunCwdDeps = {
      tmpDir: () => '/x',
      processId: 7,
      mkdirSyncFn: vi.fn(),
      existsSyncFn: vi.fn().mockReturnValue(true),
      chdirFn: vi.fn(),
    }
    expect(gunIsolateDirectory(deps)).toMatch(/shoutbox-bot-gun-7$/)
  })
})

describe('useEphemeralGunWorkingDirectory', () => {
  const origCwd = process.cwd()
  afterAll(() => {
    process.chdir(origCwd)
  })

  it('with no args uses tmpdir and default process.chdir', () => {
    const dir = useEphemeralGunWorkingDirectory()
    expect(dir).toMatch(/shoutbox-bot-gun-\d+$/)
    expect(process.cwd()).toBe(dir)
  })

  it('creates dir and chdirs', () => {
    const mkdirSyncFn = vi.fn()
    const chdirFn = vi.fn()
    const deps: GunCwdDeps = {
      tmpDir: () => '/tmp',
      processId: 42,
      mkdirSyncFn,
      existsSyncFn: vi.fn().mockReturnValue(false),
      chdirFn,
    }
    const dir = useEphemeralGunWorkingDirectory(deps)
    expect(dir).toMatch(/shoutbox-bot-gun-42$/)
    expect(mkdirSyncFn).toHaveBeenCalledWith(dir, { recursive: true })
    expect(chdirFn).toHaveBeenCalledWith(dir)
  })

  it('skips mkdir when directory already exists', () => {
    const mkdirSyncFn = vi.fn()
    const chdirFn = vi.fn()
    const deps: GunCwdDeps = {
      tmpDir: () => '/t',
      processId: 1,
      mkdirSyncFn,
      existsSyncFn: vi.fn().mockReturnValue(true),
      chdirFn,
    }
    const dir = useEphemeralGunWorkingDirectory(deps)
    expect(mkdirSyncFn).not.toHaveBeenCalled()
    expect(chdirFn).toHaveBeenCalledWith(dir)
  })
})
