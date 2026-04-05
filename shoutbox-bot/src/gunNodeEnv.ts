/**
 * Skips Gun radisk (`gun/lib/store.js`) disk writes by default (`RAD=false`).
 * AXE and multicast stay on (Gun defaults) so mesh traffic reaches public peers like the browser app.
 * Temp cwd + in-memory store avoid `./radata` EPERM under the repo; set `RAD=true` only if you want radisk.
 */
export function applyGunNodeDiskDefaults(env: NodeJS.ProcessEnv): void {
  if (env.RAD?.trim() !== 'true') {
    env.RAD = 'false'
  }
}
