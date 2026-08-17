import { defineConfig, devices } from '@playwright/test'

/**
 * Parcours E2E essentiels.
 *
 * Ils ciblent le mode LOCAL, qui ne dépend d'aucun service externe : les tests
 * tournent donc sans projet Supabase (utile en CI). Les parcours en ligne sont
 * couverts par les tests unitaires du moteur et les validations serveur.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
  },
  projects: [
    // Chromium suffit pour les deux profils : `npx playwright install chromium`.
    // Ajouter `{ name: 'safari', use: { ...devices['iPhone 13'] } }` après un
    // `npx playwright install webkit` pour couvrir iOS.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npx next start --port 3100',
        url: 'http://127.0.0.1:3100',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
