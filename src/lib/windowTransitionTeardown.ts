/**
 * Drops the active XMTP group in React state and the chat store when a sliding
 * window ends, so a stale group stream cannot deliver messages after the UI
 * epoch bumps (see transition effect in useGroupLifecycle).
 */
export interface WindowTransitionTeardownActions {
  setActiveGroupId: (id: string | null) => void
  setActiveGroup: (id: string | null) => void
}

export function teardownActiveGroupForWindowTransition(
  actions: WindowTransitionTeardownActions,
): void {
  actions.setActiveGroupId(null)
  actions.setActiveGroup(null)
}
