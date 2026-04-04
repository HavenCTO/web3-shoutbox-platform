import { describe, expect, it, vi, type Mock } from 'vitest'
import {
  teardownActiveGroupForWindowTransition,
  type WindowTransitionTeardownActions,
} from '@/lib/windowTransitionTeardown'

function createActions(): {
  actions: WindowTransitionTeardownActions
  setActiveGroupId: Mock<(id: string | null) => void>
  setActiveGroup: Mock<(id: string | null) => void>
} {
  const setActiveGroupId = vi.fn<(id: string | null) => void>()
  const setActiveGroup = vi.fn<(id: string | null) => void>()
  return {
    actions: { setActiveGroupId, setActiveGroup },
    setActiveGroupId,
    setActiveGroup,
  }
}

describe('teardownActiveGroupForWindowTransition', () => {
  it('clears hook group id and store active group', () => {
    const { actions, setActiveGroupId, setActiveGroup } = createActions()
    teardownActiveGroupForWindowTransition(actions)
    expect(setActiveGroupId).toHaveBeenCalledTimes(1)
    expect(setActiveGroupId).toHaveBeenCalledWith(null)
    expect(setActiveGroup).toHaveBeenCalledTimes(1)
    expect(setActiveGroup).toHaveBeenCalledWith(null)
  })
})
