import { describe, it, expect, vi } from 'vitest'
import { IdentifierKind } from '@xmtp/browser-sdk'
import { createGroup } from '@/services/messagingService'
import type { XmtpClient } from '@/lib/xmtp'

const GOOD = '0x1111111111111111111111111111111111111111'
const BAD = '0x000000000000000000000000000000000000dEaD'
const ROOM = 'https://shoutbox.pinme.dev/default'

/** Mock XMTP client: only addresses in `reachable` have a registered inbox. */
function makeClient(reachable: Set<string>, canMessageImpl?: (...args: never[]) => unknown) {
  return {
    canMessage: canMessageImpl
      ? vi.fn(canMessageImpl)
      : vi.fn(async (identifiers: { identifier: string }[]) => {
          const map = new Map<string, boolean>()
          for (const { identifier } of identifiers) {
            map.set(identifier, reachable.has(identifier))
          }
          return map
        }),
    conversations: {
      createGroupWithIdentifiers: vi.fn(async () => ({ id: 'test-group-id' })),
    },
  } as unknown as XmtpClient
}

describe('createGroup member filtering', () => {
  it('skips addresses with no XMTP inbox instead of failing the group', async () => {
    const client = makeClient(new Set([GOOD.toLowerCase()]))
    const result = await createGroup(client, [GOOD, BAD], ROOM)

    expect(result.ok).toBe(true)
    expect(client.conversations.createGroupWithIdentifiers).toHaveBeenCalledTimes(1)
    expect(client.conversations.createGroupWithIdentifiers).toHaveBeenCalledWith(
      [{ identifier: GOOD.toLowerCase(), identifierKind: IdentifierKind.Ethereum }],
      { groupName: ROOM },
    )
  })

  it('returns XMTP_NO_REACHABLE_MEMBERS when no address can receive', async () => {
    const client = makeClient(new Set())
    const result = await createGroup(client, [BAD], ROOM)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('XMTP_NO_REACHABLE_MEMBERS')
    }
    expect(client.conversations.createGroupWithIdentifiers).not.toHaveBeenCalled()
  })

  it('fails open with all addresses when the reachability check errors', async () => {
    const client = makeClient(new Set(), async () => {
      throw new Error('network down')
    })
    const result = await createGroup(client, [GOOD, BAD], ROOM)

    expect(result.ok).toBe(true)
    expect(client.conversations.createGroupWithIdentifiers).toHaveBeenCalledTimes(1)
    expect(client.conversations.createGroupWithIdentifiers).toHaveBeenCalledWith(
      [
        { identifier: GOOD.toLowerCase(), identifierKind: IdentifierKind.Ethereum },
        { identifier: BAD.toLowerCase(), identifierKind: IdentifierKind.Ethereum },
      ],
      { groupName: ROOM },
    )
  })
})

describe('createGroup room identity', () => {
  it('names the group after the normalized room URL so the bridge can tell which room it is', async () => {
    const client = makeClient(new Set([GOOD.toLowerCase()]))
    const result = await createGroup(client, [GOOD], 'https://shoutbox.pinme.dev/default/')

    expect(result.ok).toBe(true)
    // A trailing slash must not produce a second name: the bridge compares
    // the group name against a normalized allowlist, character for character.
    expect(client.conversations.createGroupWithIdentifiers).toHaveBeenCalledWith(
      expect.anything(),
      { groupName: ROOM },
    )
  })
})
