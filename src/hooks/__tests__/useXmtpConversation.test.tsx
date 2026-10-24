import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Group } from '@xmtp/browser-sdk'
import { useXmtpConversation } from '@/hooks/useXmtpConversation'

// React 19 requires an explicit act environment when driving roots directly.
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

/**
 * Test-controlled initialization gate, hoisted so the vi.mock factory (which
 * runs before module-level bindings initialize) can reference it: hold
 * initialization pending, then release it.
 */
const initGate = vi.hoisted(() => {
  const state = { open: true, resolvers: [] as Array<() => void> }
  const fakeGroup = {
    sync: () => Promise.resolve(),
    publishMessages: () => Promise.resolve(),
  } as unknown as Group
  return {
    state,
    fakeGroup,
    reset() {
      state.open = true
      state.resolvers.length = 0
    },
    hold() {
      state.open = false
    },
    release() {
      state.open = true
      for (const resolve of state.resolvers.splice(0)) resolve()
    },
  }
})

/**
 * Regression coverage for the render-phase reset that replaces the old
 * setState-in-effect-body reset: when any initialization input changes
 * identity (client, groupId, inboxId, retry nonce), readiness must be
 * cleared immediately during render so the composer gates sending again
 * while the conversation re-initializes.
 */

vi.mock('@/hooks/useXmtpClient', () => ({
  useXmtpClient: () => clientHolder,
}))

const clientHolder: { client: object | null; inboxId: string | null; status: string } = {
  client: null,
  inboxId: null,
  status: 'connecting',
}

vi.mock('@/lib/waitForGroupConversation', () => ({
  DEFAULT_WAIT_FOR_GROUP_OPTIONS: {},
  // Initialization is held until the test releases the gate, so the reset
  // state is deterministically observable before init completes.
  waitForGroupConversation: vi.fn(
    () =>
      new Promise((resolve) => {
        if (initGate.state.open) {
          resolve(initGate.fakeGroup)
        } else {
          initGate.state.resolvers.push(() => resolve(initGate.fakeGroup))
        }
      }),
  ),
  sleep: () => Promise.resolve(),
}))

vi.mock('@/lib/waitForGroupMembersSettled', () => ({
  DEFAULT_WAIT_MEMBERS_SETTLED_OPTIONS: {},
  waitForGroupMembersSettled: vi.fn(async () => ({ ok: true as const })),
}))

vi.mock('@/lib/xmtpGroupSync', () => ({
  syncGroupForMessaging: vi.fn(async () => true),
}))

vi.mock('@/services/messagingService', () => ({
  getGroupMessages: vi.fn(async () => ({ ok: true as const, data: [] })),
  streamGroupMessages: vi.fn(() => ({ unsubscribe: () => undefined })),
  sendMessage: vi.fn(async () => ({ ok: true as const })),
}))

vi.mock('@/lib/xmtpMlsDiagnostics', () => ({
  tryEmitXmtpMlsDiagnostic: () => undefined,
}))

type ConversationState = ReturnType<typeof useXmtpConversation>

function Host() {
  const value = useXmtpConversation(groupId)
  // Capture outside of render — the react-hooks purity rules forbid
  // reassigning outer variables during render.
  useEffect(() => {
    state = value
  })
  return null
}

let state: ConversationState | null = null
let groupId: string | null = 'group-1'
let root: Root | null = null

async function render() {
  await act(async () => {
    root?.render(createElement(Host))
  })
}

async function waitForReady() {
  await vi.waitFor(() => {
    expect(state?.messagingReady).toBe(true)
  })
}

beforeEach(() => {
  clientHolder.client = { id: 'client-a' }
  clientHolder.inboxId = 'inbox-1'
  clientHolder.status = 'ready'
  groupId = 'group-1'
  state = null
  initGate.reset()
  root = createRoot(document.createElement('div'))
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  vi.clearAllMocks()
})

describe('useXmtpConversation', () => {
  it('marks messaging ready once initialization completes', async () => {
    await render()
    await waitForReady()
    expect(state?.queuedMessageCount).toBe(0)
  })

  it('clears readiness immediately when the client is replaced, then re-initializes', async () => {
    await render()
    await waitForReady()

    // Same group and inbox, but a brand-new client instance: the render-phase
    // reset must drop readiness without waiting for the effect to re-run.
    initGate.hold()
    clientHolder.client = { id: 'client-b' }
    await render()
    expect(state?.messagingReady).toBe(false)

    // Initialization re-runs against the new client and unlocks messaging again.
    initGate.release()
    await waitForReady()
  })

  it('clears readiness when the group changes, even with the same client', async () => {
    await render()
    await waitForReady()

    initGate.hold()
    groupId = 'group-2'
    await render()
    expect(state?.messagingReady).toBe(false)

    initGate.release()
    await waitForReady()
  })

  it('queues a message while not ready and flushes it once ready', async () => {
    await render()
    await waitForReady()

    // A new group puts the conversation back into the not-ready state.
    initGate.hold()
    groupId = 'group-3'
    await render()
    expect(state?.messagingReady).toBe(false)

    await act(async () => {
      await state?.sendMessage('hello from the queue')
    })
    expect(state?.queuedMessageCount).toBe(1)

    initGate.release()
    await waitForReady()
    const { sendMessage } = await import('@/services/messagingService')
    expect(sendMessage).toHaveBeenCalledWith(initGate.fakeGroup, 'hello from the queue')
  })
})
