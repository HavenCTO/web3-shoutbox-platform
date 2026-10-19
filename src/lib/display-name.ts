/** Friendly, deterministic display names derived from an address. The raw address is never shown in chat UI. */

const ADJECTIVES = [
  'Amber', 'Brave', 'Calm', 'Clever', 'Cosmic', 'Daring', 'Eager', 'Gentle',
  'Golden', 'Happy', 'Jolly', 'Keen', 'Lively', 'Lucky', 'Mellow', 'Mighty',
  'Nimble', 'Quiet', 'Rapid', 'Ruby', 'Silent', 'Solar', 'Steady', 'Sunny',
  'Swift', 'Tidy', 'Velvet', 'Warm', 'Wild', 'Wise', 'Zesty', 'Bright',
] as const

const ANIMALS = [
  'Fox', 'Owl', 'Bear', 'Wolf', 'Deer', 'Hawk', 'Lynx', 'Otter',
  'Panda', 'Raven', 'Tiger', 'Whale', 'Zebra', 'Falcon', 'Koala', 'Lemur',
  'Moose', 'Newt', 'Orca', 'Puma', 'Quail', 'Robin', 'Seal', 'Toad',
  'Vole', 'Wren', 'Yak', 'Crane', 'Dingo', 'Emu', 'Ferret', 'Gecko',
] as const

function hashString(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Same address always maps to the same friendly name, on every client. */
export function deriveDisplayName(address: string): string {
  const normalized = (address ?? '').trim().toLowerCase()
  if (!normalized) return 'Guest'
  const hash = hashString(normalized)
  const adjective = ADJECTIVES[hash % ADJECTIVES.length]
  const animal = ANIMALS[Math.floor(hash / ADJECTIVES.length) % ANIMALS.length]
  return `${adjective} ${animal}`
}

/** Stable hue (0-359) for an avatar colour derived from an address. */
export function deriveAvatarHue(address: string): number {
  return hashString((address ?? '').trim().toLowerCase()) % 360
}
