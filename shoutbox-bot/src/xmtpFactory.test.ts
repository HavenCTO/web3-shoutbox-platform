import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Client } from '@xmtp/node-sdk'
import { createShoutboxBotClient } from './xmtpFactory.js'

const VALID_PK =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

describe('createShoutboxBotClient', () => {
  let createSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    createSpy = vi
      .spyOn(Client as unknown as { create: typeof Client.create }, 'create')
      .mockResolvedValue({} as Client)
  })

  afterEach(() => {
    createSpy.mockRestore()
  })

  it('forwards storage and network options to Client.create', async () => {
    const dbEncryptionKey = new Uint8Array(32)
    await createShoutboxBotClient({
      privateKey: VALID_PK,
      env: 'production',
      dbPath: './bot.db3',
      dbEncryptionKey,
    })
    expect(createSpy).toHaveBeenCalledTimes(1)
    const [, opts] = createSpy.mock.calls[0]
    expect(opts).toMatchObject({
      env: 'production',
      dbPath: './bot.db3',
      dbEncryptionKey,
    })
    const [signer] = createSpy.mock.calls[0]
    expect(signer.type).toBe('EOA')
  })
})
