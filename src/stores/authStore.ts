import { create } from 'zustand'

interface AuthState {
  isConnected: boolean
  address: string | undefined
  chainId: number | undefined
  isConnecting: boolean
  error: string | null
  setConnected: (address: string, chainId: number) => void
  setDisconnected: () => void
  setConnecting: (connecting: boolean) => void
  setError: (error: string | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isConnected: false,
  address: undefined,
  chainId: undefined,
  isConnecting: false,
  error: null,
  setConnected: (address, chainId) =>
    set({ isConnected: true, address, chainId, isConnecting: false, error: null }),
  setDisconnected: () =>
    set({ isConnected: false, address: undefined, chainId: undefined, isConnecting: false, error: null }),
  setConnecting: (connecting) => set({ isConnecting: connecting }),
  setError: (error) => set({ error, isConnecting: false }),
}))
