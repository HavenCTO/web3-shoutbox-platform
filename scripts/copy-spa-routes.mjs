#!/usr/bin/env node
/**
 * Materialize client-side routes as real directories.
 *
 * Vite emits a single `out/index.html`. That is fine on hosts with SPA
 * rewrites (Netlify `_redirects`, Cloudflare Pages), but IPFS gateways
 * (PinMe) serve content-addressed files and have no rewrite layer. Without
 * these copies `/rooms`, `/settings`, and `/embed/shoutbox` would 404 after
 * an IPFS deploy, which would break the widget's primary use case.
 *
 * The copies are byte-identical to `out/index.html`; the client router
 * resolves the route from `window.location.pathname` once the app boots.
 */
import { copyFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const outDir = 'out'
const source = join(outDir, 'index.html')

const routes = [
  'rooms',
  'settings',
  'embed/shoutbox',
]

for (const route of routes) {
  const targetDir = join(outDir, route)
  await mkdir(targetDir, { recursive: true })
  await copyFile(source, join(targetDir, 'index.html'))
  console.log(`copied ${source} -> ${join(targetDir, 'index.html')}`)
}
