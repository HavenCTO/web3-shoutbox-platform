/**
 * Messaging is safe only when init has completed for the same group id the UI is showing.
 * Without this, `messagingReady` from a prior session stays true for one or more renders after
 * `groupId` changes (before `useEffect` runs), which unlocks the composer incorrectly.
 */
export function isConversationReadyForGroup(
  activeGroupId: string | null,
  loadedGroupId: string | null,
): boolean {
  return activeGroupId !== null && loadedGroupId === activeGroupId
}
