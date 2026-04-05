import { describe, it, expect } from 'vitest'
import {
  isActiveGroupWindow,
  parseGroupWindowFromGun,
  type GroupWindow,
} from './groupWindow.js'

const validWindow: GroupWindow = {
  groupId: 'abc',
  epoch: 1,
  createdBy: 'creator',
  createdAt: 1,
  expiresAt: 10_000,
  windowMinutes: 5,
}

describe('parseGroupWindowFromGun', () => {
  it('accepts a full group window object', () => {
    expect(parseGroupWindowFromGun(validWindow)).toEqual(validWindow)
  })

  it('rejects invalid payloads', () => {
    expect(parseGroupWindowFromGun({})).toBeNull()
    expect(parseGroupWindowFromGun(null)).toBeNull()
    expect(parseGroupWindowFromGun({ groupId: '' })).toBeNull()
  })
})

describe('isActiveGroupWindow', () => {
  it('is active when now is before expiry', () => {
    expect(isActiveGroupWindow(validWindow, validWindow.expiresAt)).toBe(true)
  })

  it('is inactive after expiry', () => {
    expect(isActiveGroupWindow(validWindow, validWindow.expiresAt + 1)).toBe(false)
  })
})
