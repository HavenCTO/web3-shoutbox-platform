import { describe, it, expect } from 'vitest'
import { withAgentPresence } from '@/lib/agentPresence'
import type { OnlineUser } from '@/types/presence'

const BRIDGE = '0x90779A7582aAFB91b9ad78E9f3a3cba88Ed44042'

function makeUser(inboxId: string, address: string): OnlineUser {
  return { inboxId, address, lastSeen: Date.now(), isOnline: true }
}

describe('withAgentPresence', () => {
  it('adds the bridge when no human entry matches it', () => {
    const users = [makeUser('inbox-a', '0xaaaa')]
    const out = withAgentPresence(users, [BRIDGE])
    expect(out).toHaveLength(2)
    expect(out[1].address).toBe(BRIDGE)
    expect(out[1].isOnline).toBe(true)
  })

  it('does not duplicate a bridge already present (case-insensitive)', () => {
    const users = [makeUser('inbox-a', BRIDGE.toLowerCase())]
    const out = withAgentPresence(users, [BRIDGE])
    expect(out).toHaveLength(1)
  })

  it('returns the human list unchanged when no agents configured', () => {
    const users = [makeUser('inbox-a', '0xaaaa')]
    expect(withAgentPresence(users, [])).toEqual(users)
  })

  it('adds the bridge to an empty room list', () => {
    const out = withAgentPresence([], [BRIDGE])
    expect(out).toHaveLength(1)
    expect(out[0].inboxId).toBe(`bridge:${BRIDGE.toLowerCase()}`)
  })
})
