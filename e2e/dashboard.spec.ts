import { expect, test } from '@playwright/test'

test('shows the America Online Pro demo dashboard', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /good morning, godwin/i })).toBeVisible()
  await expect(page.getByText(/demo environment · no real money/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /hide balance/i })).toBeVisible()
})
