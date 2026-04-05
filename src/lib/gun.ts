import Gun from 'gun'
import type { GunInstance } from 'gun'
import { env } from '@/config/env'
import { GUN_NAMESPACE } from '@/lib/gunNamespace'

let instance: GunInstance | null = null

/** Create or return the singleton GunDB instance */
export function getGunInstance(): GunInstance {
  if (instance) return instance

  const peers = env.VITE_GUN_RELAY_PEERS.split(',').filter(Boolean)

  instance = Gun({ peers })
  return instance
}

/** Get a GunDB reference under the shoutbox namespace */
export function gunRef(path: string): GunInstance {
  return getGunInstance().get(GUN_NAMESPACE).get(path)
}

export { GUN_NAMESPACE }
