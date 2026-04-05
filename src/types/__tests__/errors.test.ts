import { isInstallationLimitError } from '@/types/errors'

describe('isInstallationLimitError', () => {
  it('returns true for legacy limit/maximum wording', () => {
    expect(
      isInstallationLimitError(
        new Error('installation limit reached maximum installations'),
      ),
    ).toBe(true)
  })

  it('returns true for XMTP 10/10 registration error', () => {
    expect(
      isInstallationLimitError(
        new Error(
          'Cannot register a new installation because the InboxID x has already registered 10/10 installations. Please revoke existing installations first.',
        ),
      ),
    ).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isInstallationLimitError(new Error('network timeout'))).toBe(false)
  })
})
