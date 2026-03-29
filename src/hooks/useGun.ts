import { createContext, useContext } from 'react'
import type { GunInstance } from 'gun'

export const GunContext = createContext<GunInstance | null>(null)

export function useGun(): GunInstance {
  const gun = useContext(GunContext)
  if (!gun) {
    throw new Error('useGun must be used within a GunProvider')
  }
  return gun
}
