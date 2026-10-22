import { expect, test } from '@playwright/test'

test('shows the sign-in page and lets visitors open registration', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible()
  await expect(page.getByText(/supabase is not connected/i)).toBeVisible()
  await page.getByRole('button', { name: /create an account/i }).click()
  await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible()
  await expect(page.getByLabel('Full name')).toBeVisible()
})
