import { env } from '@/config/env'

const KEY = 'shoutbox:gate-topup:'

/** Join = top-up: silently ask the faucet to fund the guest address to the
 *  gate threshold. Fire-and-forget — chat never waits on the chain, and a
 *  down faucet only means gated tracks stay locked a little longer. */
export function requestGateTopUp(address: string | null | undefined): void {
  const url = env.VITE_GATE_FAUCET_URL
  if (!url || !address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return
  const stamp = `${KEY}${address.toLowerCase()}`
  try {
    if (Date.now() - Number(localStorage.getItem(stamp) || 0) < 3600_000) return
    localStorage.setItem(stamp, String(Date.now()))
  } catch { /* storage unavailable — still attempt once per page load */ }
  void fetch(`${url.replace(/\/$/, '')}/mint`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address }), keepalive: true,
  }).catch(() => { try { localStorage.removeItem(stamp) } catch { /* noop */ } })
}
