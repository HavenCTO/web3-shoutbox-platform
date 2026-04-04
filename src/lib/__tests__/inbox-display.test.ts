import { describe, it, expect } from 'vitest'
import {
  truncateInboxId,
  buildInboxAddressLookup,
  resolveSenderAddressForDisplay,
} from '@/lib/inbox-display'
import type { OnlineUser } from '@/types/presence'

describe('truncateInboxId', () => {
  it('returns short ids unchanged', () => {
    expect(truncateInboxId('abc')).toBe('abc')
  })

  it('truncates long inbox ids', () => {
    const id = '637e32dc3f9ec9770b7e69c8b0262b6959ec864298ada870d2ef30957dd87fbb'
    expect(truncateInboxId(id)).toBe('637e32dc…57dd87fbb')
  })
})

describe('buildInboxAddressLookup', () => {
  it('merges online users and self', () => {
    const online: OnlineUser[] = [
      {
        inboxId: 'inbox-a',
        address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        lastSeen: 1,
        isOnline: true,
      },
    ]
    const m = buildInboxAddressLookup(online, 'inbox-me', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
    expect(m.get('inbox-a')).toMatch(/^0xaaa/)
    expect(m.get('inbox-me')).toMatch(/^0xbbb/)
  })

  it('skips empty addresses on online users', () => {
    const online: OnlineUser[] = [
      { inboxId: 'x', address: '', lastSeen: 1, isOnline: true },
    ]
    const m = buildInboxAddressLookup(online, null, null)
    expect(m.has('x')).toBe(false)
  })
})

describe('resolveSenderAddressForDisplay', () => {
  it('returns address from lookup when present', () => {
    const lookup = new Map([['i1', '0x1111111111111111111111111111111111111111']])
    expect(resolveSenderAddressForDisplay('i1', lookup)).toBe('0x1111111111111111111111111111111111111111')
  })

  it('falls back to truncated inbox id', () => {
    const lookup = new Map<string, string>()
    const id = '637e32dc3f9ec9770b7e69c8b0262b6959ec864298ada870d2ef30957dd87fbb'
    expect(resolveSenderAddressForDisplay(id, lookup)).toBe('637e32dc…57dd87fbb')
  })
})
