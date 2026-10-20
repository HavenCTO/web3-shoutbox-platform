/* global process, console, setTimeout */
// Static GunDB relay peer for the Web3 Shoutbox.
//
// The shoutbox frontend is static hosting (IPFS / PinMe) with no backend.
// Browsers are ephemeral Gun peers: without at least one always-on relay,
// every visitor is an island — they only ever see themselves online, the
// 2-participant group gate never opens, and queued messages never flush.
// This process is that always-on ("static") relay.
//
// Local dev:   npm run relay
// Production:  GUN_RELAY_PORT=8765 GUN_RELAY_DATA=/var/lib/gun-relay \
//              node scripts/gun-relay.mjs   (or the gun-relay systemd unit)
//
// Then point the hosted app at it:
//   VITE_GUN_RELAY_PEERS=https://<relay-host>/gun
import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import Gun from 'gun'
import 'gun/lib/file.js'

const HOST = process.env.GUN_RELAY_HOST || '0.0.0.0'
const PORT = Number(process.env.GUN_RELAY_PORT || process.env.PORT) || 8765
const DATA_FILE =
  process.env.GUN_RELAY_DATA ||
  path.join(process.cwd(), 'data', 'gun', 'relay')
// Optional upstream mesh peers (comma-separated wss/https URLs). Empty by
// default: this relay is authoritative for shoutbox presence on its own.
const PEERS = (process.env.GUN_RELAY_PEERS || '')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean)

fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
  'access-control-allow-headers': 'content-type',
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS)
    res.end()
    return
  }
  // Let Gun's own handler answer /gun (websocket + sync traffic).
  if (req.url === '/gun' || req.url?.startsWith('/gun/')) return
  if (req.url === '/healthz' || req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json', ...CORS_HEADERS })
    res.end(JSON.stringify({ ok: true, service: 'gun-relay' }))
    return
  }
  res.writeHead(200, { 'content-type': 'text/plain', ...CORS_HEADERS })
  res.end('gun relay ok\n')
})

Gun({ web: server, file: DATA_FILE, peers: PEERS })

server.listen(PORT, HOST, () => {
  console.log(`Gun relay listening on http://${HOST}:${PORT}/gun (data: ${DATA_FILE})`)
})

function shutdown(signal) {
  console.log(`Gun relay received ${signal}, shutting down`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 5000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
