/* global process, console */
// Local GunDB relay peer.
//
// Presence and group coordination travel over Gun, which needs at least one
// reachable relay peer to connect separate browsers. Without it every visitor
// is an island: they only ever see themselves online, the 2-participant group
// gate never opens, and queued messages never flush.
//
// Run:  npm run relay        (listens on GUN_RELAY_PORT, default 8765)
// Then point the app at it:  VITE_GUN_RELAY_PEERS=http://localhost:8765/gun
//
// For production, host this (or any Gun relay) somewhere reachable and set
// VITE_GUN_RELAY_PEERS to its https URL instead.
import http from 'node:http'
import Gun from 'gun'

const port = Number(process.env.GUN_RELAY_PORT) || 8765

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' })
  res.end('gun relay ok\n')
})

Gun({ web: server })

server.listen(port, () => {
  console.log(`Gun relay listening on http://localhost:${port}/gun`)
})
