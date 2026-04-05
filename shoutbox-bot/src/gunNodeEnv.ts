/**
 * Enables Gun radisk backed by the in-memory store so `put` data propagates
 * through relay peers correctly.  AXE and multicast stay on (Gun defaults)
 * so mesh traffic reaches public peers like the browser app.
 * Temp cwd + in-memory store avoid `./radata` EPERM under the repo.
 */
export function applyGunNodeDiskDefaults(env: NodeJS.ProcessEnv): void {
  if (env.RAD === undefined || env.RAD.trim() === '') {
    env.RAD = 'true'
  }
}
