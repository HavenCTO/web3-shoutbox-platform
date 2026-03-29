import { type ReactNode, useMemo } from 'react'
import { getGunInstance } from '@/lib/gun'
import { GunContext } from '@/hooks/useGun'

export function GunProvider({ children }: { children: ReactNode }) {
  const gun = useMemo(() => getGunInstance(), [])

  return <GunContext.Provider value={gun}>{children}</GunContext.Provider>
}
