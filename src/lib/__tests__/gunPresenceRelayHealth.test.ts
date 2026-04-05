import { describe, it, expect } from 'vitest'
import { nextPresenceSyncStatusFromAck } from '@/lib/gunPresenceRelayHealth'

describe('nextPresenceSyncStatusFromAck', () => {
  it('returns synced when ack has no error', () => {
    expect(nextPresenceSyncStatusFromAck({})).toBe('synced')
  })

  it('returns degraded when ack.err is set', () => {
    expect(nextPresenceSyncStatusFromAck({ err: 'network' })).toBe('degraded')
  })

  it('treats lack timeout as failure when wrapped in err', () => {
    expect(
      nextPresenceSyncStatusFromAck({ err: 'Error: No ACK yet.', lack: true }),
    ).toBe('degraded')
  })
})
