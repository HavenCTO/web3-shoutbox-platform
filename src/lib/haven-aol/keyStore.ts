/**
 * Persistent key cache (IndexedDB) so an unlock survives tab closes and
 * the 60-minute channel rotation without another ICP canister call.
 *
 * Two layers, both device-local and never transmitted:
 *  - VetKey per (chain, token, threshold, epoch) — expires at epoch end.
 *  - AES content key per track — expires with its VetKey's epoch or 24h.
 *
 * The cache is a shortcut, not enforcement: the canister gates first
 * unlock, and a cached key replays until it expires. In-memory Maps stay
 * as the hot layer in front of this store.
 */
export interface StoredBytes { bytes: Uint8Array; expiresAt: number }

const DB = 'shoutbox:gate-keys'
const STORES = ['vetkeys', 'aeskeys'] as const

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(store: string, key: string): Promise<StoredBytes | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve) => {
      const tx = db.transaction(store, 'readonly')
      const req = tx.objectStore(store).get(key)
      req.onsuccess = () => {
        const v = req.result as StoredBytes | undefined
        db.close()
        if (!v || Date.now() > v.expiresAt) resolve(null)
        else resolve(v)
      }
      req.onerror = () => { db.close(); resolve(null) }
    })
  } catch { return null }
}

async function idbSet(store: string, key: string, value: StoredBytes): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).put(value, key)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); resolve() }
    })
  } catch { /* private mode etc: memory layer still works */ }
}

export async function getVetKey(key: string): Promise<Uint8Array | null> {
  return (await idbGet('vetkeys', key))?.bytes ?? null
}
export async function setVetKey(key: string, bytes: Uint8Array, expiresAt: number): Promise<void> {
  await idbSet('vetkeys', key, { bytes, expiresAt })
}
export async function getAesKey(key: string): Promise<Uint8Array | null> {
  return (await idbGet('aeskeys', key))?.bytes ?? null
}
export async function setAesKey(key: string, bytes: Uint8Array, expiresAt: number): Promise<void> {
  await idbSet('aeskeys', key, { bytes, expiresAt })
}
export async function clearKey(key: string): Promise<void> {
  try {
    const db = await openDb()
    await Promise.all(STORES.map((s) => new Promise<void>((resolve) => {
      const tx = db.transaction(s, 'readwrite')
      tx.objectStore(s).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })))
    db.close()
  } catch { /* noop */ }
}
