import { test, expect, type Page } from '@playwright/test'

/**
 * Regression test for the two-visitor stall: two brand-new visitors (fresh
 * auto-generated identities, no wallet, no onboarding) must be able to chat.
 *
 * Covers the exact path that silently broke when the Gun relay peers died:
 * presence discovery -> leader creates the XMTP group -> a message queued by
 * the first visitor while alone flushes and is delivered to the second.
 *
 * Uses a unique room per run so Gun/XMTP state from earlier runs (including
 * the 5-minute group window) cannot leak in.
 */

// XMTP registration + group creation on the dev network is slow.
test.setTimeout(300_000)

const JOIN_TIMEOUT = 120_000
const DELIVERY_TIMEOUT = 180_000

async function aliasOf(page: Page): Promise<string> {
  // The header identity badge renders as "<Alias> (you)".
  await page.waitForFunction(
    () => /[A-Z][a-z]+ [A-Z][a-z]+ \(you\)/.test(document.body.innerText),
    { timeout: JOIN_TIMEOUT },
  )
  const alias = await page.evaluate(() => {
    const match = document.body.innerText.match(/([A-Z][a-z]+ [A-Z][a-z]+) \(you\)/)
    return match?.[1] ?? ''
  })
  expect(alias).not.toBe('')
  return alias
}

test('two fresh visitors chat with no wallet or onboarding', async ({ browser }) => {
  const room = `https://shoutbox.example.com/e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const roomPath = `/?room=${encodeURIComponent(room)}`

  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  try {
    // Visitor A arrives alone: chat is usable immediately, no connect step.
    await pageA.goto(roomPath)
    await expect(pageA.getByText('Connect Wallet')).toHaveCount(0)
    const composerA = pageA.locator('textarea')
    await expect(composerA).toBeEnabled({ timeout: JOIN_TIMEOUT })
    await expect(composerA).toHaveAttribute(
      'placeholder',
      'Type a message — it will send when someone joins…',
    )

    const aliasA = await aliasOf(pageA)
    expect(aliasA).not.toContain('0x')

    // A types before anyone else is here — the message must queue, not drop.
    const queuedText = `queued-hello-${Date.now()}`
    await composerA.fill(queuedText)
    await composerA.press('Enter')
    await expect(pageA.getByText(/1 message queued/)).toBeVisible({ timeout: 15_000 })

    // Visitor B joins the same room as a different fresh identity.
    await pageB.goto(roomPath)
    await expect(pageB.getByText('Connect Wallet')).toHaveCount(0)
    const aliasB = await aliasOf(pageB)
    expect(aliasB).not.toContain('0x')
    expect(aliasB).not.toBe(aliasA)

    // Both visitors discover each other.
    await expect(pageA.getByText('2 online', { exact: true })).toBeVisible({ timeout: JOIN_TIMEOUT })
    await expect(pageB.getByText('2 online', { exact: true })).toBeVisible({ timeout: JOIN_TIMEOUT })

    // A's queued message flushes, appears for A, and is delivered to B.
    await expect(pageB.getByText(queuedText)).toBeVisible({ timeout: DELIVERY_TIMEOUT })
    await expect(pageA.getByText(queuedText)).toBeVisible({ timeout: 30_000 })
    await expect(pageA.getByText(/message queued/)).toHaveCount(0)

    // B can reply and A receives it live.
    const composerB = pageB.locator('textarea')
    await expect(composerB).toBeEnabled({ timeout: JOIN_TIMEOUT })
    await expect(composerB).toHaveAttribute('placeholder', 'Type a message…', {
      timeout: JOIN_TIMEOUT,
    })
    const replyText = `reply-${Date.now()}`
    await composerB.fill(replyText)
    await composerB.press('Enter')
    await expect(pageA.getByText(replyText)).toBeVisible({ timeout: DELIVERY_TIMEOUT })
    // Wait for the draft to clear first: while the send is in flight the
    // composer still holds the text, and getByText would match both the
    // delivered bubble and the draft (a strict-mode violation).
    await expect(composerB).toHaveValue('', { timeout: 30_000 })
    await expect(pageB.getByText(replyText)).toBeVisible({ timeout: 30_000 })
  } finally {
    await contextA.close()
    await contextB.close()
  }
})
