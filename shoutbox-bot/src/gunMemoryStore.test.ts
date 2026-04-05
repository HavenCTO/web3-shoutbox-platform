import { describe, it, expect } from 'vitest'
import { createShoutboxGunMemoryStore } from './gunMemoryStore.js'

describe('createShoutboxGunMemoryStore', () => {
  it('round-trips put/get', async () => {
    const store = createShoutboxGunMemoryStore()
    await new Promise<void>((resolve, reject) => {
      store.put('k1', 'hello', (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
    await new Promise<void>((resolve, reject) => {
      store.get('k1', (err, data) => {
        if (err) reject(err)
        else {
          expect(data).toBe('hello')
          resolve()
        }
      })
    })
  })

  it('get missing key invokes cb like a filesystem miss', async () => {
    const store = createShoutboxGunMemoryStore()
    await new Promise<void>((resolve) => {
      store.get('nope', (...args: unknown[]) => {
        expect(args.length).toBe(0)
        resolve()
      })
    })
  })

  it('list yields all keys then ends', async () => {
    const store = createShoutboxGunMemoryStore()
    const put = (k: string, v: string) =>
      new Promise<void>((resolve, reject) => {
        store.put(k, v, (e) => (e ? reject(e) : resolve()))
      })
    await put('a', '1')
    await put('b', '2')
    const seen: string[] = []
    store.list((f) => {
      if (typeof f === 'string') seen.push(f)
    })
    expect(seen.sort()).toEqual(['a', 'b'])
  })
})
