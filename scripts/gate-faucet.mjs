/**
 * Join = top-up faucet (Sepolia testnet only).
 * The browser calls POST /mint {address} once when a guest joins. This
 * service — never the agent, never the browser — tops the guest up to
 * exactly GATE_THRESHOLD whole tokens: balanceOf is read before any
 * write, and an address at/above threshold gets no transaction.
 * Env: GATE_TOKEN_ADDRESS, FAUCET_PRIVATE_KEY, SEPOLIA_RPC_URL,
 *      GATE_THRESHOLD (whole tokens, default 1), GATE_FAUCET_MODE (mint|transfer),
 *      GATE_FAUCET_PORT (default 8787)
 */
/* eslint-disable no-undef -- Node script, not browser code */
import http from 'node:http'
import { createPublicClient, createWalletClient, http as viemHttp, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

const token = process.env.GATE_TOKEN_ADDRESS
const key = process.env.FAUCET_PRIVATE_KEY
const thresholdWhole = BigInt(process.env.GATE_THRESHOLD || '1')
const mode = process.env.GATE_FAUCET_MODE || 'mint'
const port = Number(process.env.GATE_FAUCET_PORT || 8787)
if (!token || !key) { console.error('GATE_TOKEN_ADDRESS and FAUCET_PRIVATE_KEY are required'); process.exit(1) }

const account = privateKeyToAccount(key.startsWith('0x') ? key : `0x${key}`)
const pub = createPublicClient({ chain: sepolia, transport: viemHttp(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com') })
const wallet = createWalletClient({ account, chain: sepolia, transport: viemHttp(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com') })
const ABI = parseAbi(['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function mint(address,uint256)', 'function transfer(address,uint256) returns (bool)'])
const ADDR = /^0x[0-9a-fA-F]{40}$/
const lastMint = new Map(); const ipHits = new Map()
let queue = Promise.resolve()

async function topUp(address) {
  const [balance, decimals] = await Promise.all([
    pub.readContract({ address: token, abi: ABI, functionName: 'balanceOf', args: [address] }),
    pub.readContract({ address: token, abi: ABI, functionName: 'decimals' }),
  ])
  const target = thresholdWhole * 10n ** BigInt(decimals)
  if (balance >= target) return { status: 'already-funded', balance: balance.toString() }
  const amount = target - balance
  const hash = await wallet.writeContract({ address: token, abi: ABI, functionName: mode === 'transfer' ? 'transfer' : 'mint', args: [address, amount] })
  return { status: 'topped-up', amount: amount.toString(), hash }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type')
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
  if (req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, chain: 'sepolia', token })) }
  if (req.method !== 'POST' || req.url !== '/mint') { res.writeHead(404); return res.end() }
  let body = ''
  req.on('data', (c) => { body += c; if (body.length > 1024) req.destroy() })
  req.on('end', () => {
    void (async () => {
      try {
        const { address } = JSON.parse(body || '{}')
        if (!ADDR.test(address || '')) { res.writeHead(400, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: 'bad address' })) }
        const addr = address.toLowerCase()
        const now = Date.now()
        if (now - (lastMint.get(addr) || 0) < 3600_000) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ status: 'recently-funded' })) }
        const ip = req.socket.remoteAddress || '?'
        const hits = (ipHits.get(ip) || []).filter((t) => now - t < 3600_000)
        if (hits.length >= 20) { res.writeHead(429, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: 'rate limited' })) }
        ipHits.set(ip, [...hits, now]); lastMint.set(addr, now)
        // Serialize writes: one faucet wallet, sequential nonces.
        const run = queue.then(() => topUp(addr)); queue = run.catch(() => {})
        const result = await run
        res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(result))
      } catch (e) { res.writeHead(502, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: String(e?.message || e).slice(0, 200) })) }
    })()
  })
})
server.listen(port, () => console.log(`gate-faucet on :${port} token=${token} mode=${mode} threshold=${thresholdWhole}`))
