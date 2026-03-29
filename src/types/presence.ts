export interface PresenceRecord {
  inboxId: string
  address: string
  timestamp: number
  status: 'online' | 'away' | 'offline'
}

export interface OnlineUser {
  inboxId: string
  address: string
  lastSeen: number
  isOnline: boolean
}
