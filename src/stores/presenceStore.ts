import { create } from 'zustand'
import type { OnlineUser } from '@/types/presence'

interface PresenceState {
  isPresent: boolean
  roomKey: string | null
  heartbeatActive: boolean
  onlineUsers: OnlineUser[]
  setPresent: (roomKey: string) => void
  clearPresence: () => void
  setOnlineUsers: (users: OnlineUser[]) => void
}

export const usePresenceStore = create<PresenceState>((set) => ({
  isPresent: false,
  roomKey: null,
  heartbeatActive: false,
  onlineUsers: [],
  setPresent: (roomKey) => set({ isPresent: true, roomKey, heartbeatActive: true }),
  clearPresence: () => set({ isPresent: false, roomKey: null, heartbeatActive: false, onlineUsers: [] }),
  setOnlineUsers: (users) => set({ onlineUsers: users }),
}))
