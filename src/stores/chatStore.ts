import { create } from 'zustand'
import type { ShoutboxMessage } from '@/types/message'

interface ChatState {
  messages: ShoutboxMessage[]
  activeGroupId: string | null
  windowEpoch: number
  previousWindowMessages: ShoutboxMessage[]
  isLoading: boolean
  error: string | null
  addMessage: (msg: ShoutboxMessage) => void
  setMessages: (msgs: ShoutboxMessage[]) => void
  setActiveGroup: (groupId: string | null) => void
  clearMessages: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  transitionToEpoch: (epoch: number) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  activeGroupId: null,
  windowEpoch: 0,
  previousWindowMessages: [],
  isLoading: false,
  error: null,
  addMessage: (msg) =>
    set((state) => ({
      messages: state.messages.some((m) => m.id === msg.id)
        ? state.messages
        : [...state.messages, msg],
    })),
  setMessages: (msgs) => set({ messages: msgs }),
  setActiveGroup: (groupId) => set({ activeGroupId: groupId }),
  clearMessages: () => set({ messages: [] }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  transitionToEpoch: (epoch) =>
    set((state) => {
      if (epoch <= state.windowEpoch) return state
      return {
        windowEpoch: epoch,
        previousWindowMessages: state.messages,
        messages: [],
      }
    }),
}))
