import { create } from 'zustand'
import { dedupeShoutboxMessagesById } from '@/lib/messageDedupe'
import type { ShoutboxMessage } from '@/types/message'

interface ChatState {
  messages: ShoutboxMessage[]
  activeGroupId: string | null
  windowEpoch: number
  previousWindowMessages: ShoutboxMessage[]
  isLoading: boolean
  error: string | null
  /** Set with conversation `error` when originating from MessagingError.code */
  errorCode: string | null
  addMessage: (msg: ShoutboxMessage) => void
  setMessages: (msgs: ShoutboxMessage[]) => void
  setActiveGroup: (groupId: string | null) => void
  clearMessages: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null, code?: string | null) => void
  transitionToEpoch: (epoch: number) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  activeGroupId: null,
  windowEpoch: 0,
  previousWindowMessages: [],
  isLoading: false,
  error: null,
  errorCode: null,
  addMessage: (msg) =>
    set((state) => ({
      messages: state.messages.some((m) => m.id === msg.id)
        ? state.messages
        : [...state.messages, msg],
    })),
  setMessages: (msgs) => set({ messages: dedupeShoutboxMessagesById(msgs) }),
  setActiveGroup: (groupId) => set({ activeGroupId: groupId }),
  clearMessages: () => set({ messages: [] }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error, code = null) =>
    set(error === null ? { error: null, errorCode: null } : { error, errorCode: code ?? null }),
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
