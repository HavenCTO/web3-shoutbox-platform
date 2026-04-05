/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'gun' {
  export interface GunInstance {
    get(key: string): GunInstance
    put(data: any, cb?: (ack: { err?: string }) => void): GunInstance
    on(cb: (data: any, key: string) => void): GunInstance
    once(cb?: (data: any, key: string) => void): GunInstance
    map(): GunInstance
    set(data: any, cb?: (ack: { err?: string }) => void): GunInstance
    off(): void
  }

  interface GunConstructorOptions {
    peers?: string[]
    localStorage?: boolean
    radisk?: boolean
    rad?: boolean
    rfs?: boolean
    [key: string]: any
  }

  interface GunStatic {
    (options?: GunConstructorOptions): GunInstance
    new (options?: GunConstructorOptions): GunInstance
  }

  const Gun: GunStatic
  export default Gun
}
