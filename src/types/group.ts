export interface GroupWindow {
  groupId: string
  epoch: number
  createdBy: string
  createdAt: number
  expiresAt: number
  windowMinutes: number
}

export type GroupState =
  | 'idle'
  | 'waiting-for-peers'
  | 'waiting-for-group'
  | 'active'
  | 'expiring'
  | 'transitioning'
