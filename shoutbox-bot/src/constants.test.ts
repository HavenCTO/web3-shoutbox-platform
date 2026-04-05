import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CONTEXT_MESSAGE_LIMIT,
  DEFAULT_GUN_RELAY_PEERS,
  DEFAULT_SHOUTBOX_LLM_SYSTEM_PROMPT,
  GUN_NAMESPACE,
  PRESENCE_HEARTBEAT_MS,
} from './constants.js'

describe('constants', () => {
  it('uses the same Gun namespace as the web app', () => {
    expect(GUN_NAMESPACE).toBe('shoutbox-v1')
  })

  it('provides default public Gun peers', () => {
    expect(DEFAULT_GUN_RELAY_PEERS.length).toBeGreaterThan(0)
  })

  it('heartbeats on the same cadence as the web presence service', () => {
    expect(PRESENCE_HEARTBEAT_MS).toBe(10_000)
  })

  it('provides a non-empty default LLM system prompt', () => {
    expect(DEFAULT_SHOUTBOX_LLM_SYSTEM_PROMPT.length).toBeGreaterThan(20)
  })

  it('defaults context message limit to a sane window size', () => {
    expect(DEFAULT_CONTEXT_MESSAGE_LIMIT).toBe(50)
  })
})
