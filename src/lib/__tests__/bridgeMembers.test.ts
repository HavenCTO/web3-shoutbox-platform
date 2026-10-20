import { describe, it, expect } from 'vitest'
import { mergeMemberAddresses, parseBridgeAddresses } from '@/lib/bridgeMembers'

const A = '0x' + 'a'.repeat(40)
const B = '0x' + 'b'.repeat(40)
const A_MIXED = '0x' + 'A'.repeat(40)

describe('parseBridgeAddresses', () => {
  it('returns nothing for unset or blank values', () => {
    expect(parseBridgeAddresses(undefined)).toEqual([])
    expect(parseBridgeAddresses('')).toEqual([])
    expect(parseBridgeAddresses(' , ')).toEqual([])
  })

  it('normalizes, validates and deduplicates', () => {
    expect(parseBridgeAddresses(` ${A_MIXED}, ${B} , ${A}, nonsense, 0x123`)).toEqual([A, B])
  })
})

describe('mergeMemberAddresses', () => {
  it('appends standing members after online ones without duplicates', () => {
    expect(mergeMemberAddresses([B, A_MIXED], [A, B])).toEqual([B, A])
    expect(mergeMemberAddresses([], [A])).toEqual([A])
    expect(mergeMemberAddresses([A], [])).toEqual([A])
  })
})
