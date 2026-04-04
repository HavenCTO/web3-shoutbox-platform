import { describe, it, expect, vi } from 'vitest'
import { resyncXmtpConversation } from '@/services/resyncXmtpConversation'
import type { Group } from '@xmtp/browser-sdk'
import type { XmtpClient } from '@/lib/xmtp'

describe('resyncXmtpConversation', () => {
  it('calls client.conversations.sync then group.sync and returns ok', async () => {
    const order: string[] = []
    const client = {
      conversations: {
        sync: vi.fn(async () => {
          order.push('conversations')
        }),
      },
    } as unknown as XmtpClient
    const group = {
      sync: vi.fn(async () => {
        order.push('group')
      }),
    } as unknown as Group

    const result = await resyncXmtpConversation(client, group)

    expect(result.ok).toBe(true)
    expect(order).toEqual(['conversations', 'group'])
    expect((client as { conversations: { sync: ReturnType<typeof vi.fn> } }).conversations.sync).toHaveBeenCalledTimes(1)
    expect(group.sync).toHaveBeenCalledTimes(1)
  })

  it('returns err when conversations.sync throws', async () => {
    const client = {
      conversations: {
        sync: vi.fn(async () => {
          throw new Error('sync failed')
        }),
      },
    } as unknown as XmtpClient
    const group = { sync: vi.fn() } as unknown as Group

    const result = await resyncXmtpConversation(client, group)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toBe('sync failed')
      expect(result.error.code).toBe('XMTP_RESYNC_FAILED')
    }
    expect(group.sync).not.toHaveBeenCalled()
  })

  it('returns err when group.sync throws', async () => {
    const client = {
      conversations: {
        sync: vi.fn(async () => undefined),
      },
    } as unknown as XmtpClient
    const group = {
      sync: vi.fn(async () => {
        throw new Error('group sync failed')
      }),
    } as unknown as Group

    const result = await resyncXmtpConversation(client, group)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toBe('group sync failed')
    }
  })
})
