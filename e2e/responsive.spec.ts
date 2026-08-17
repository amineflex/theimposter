import { expect, test } from '@playwright/test'

/** Aucun débordement horizontal, du plus petit écran au desktop. */
const SIZES = [
  { name: '320', width: 320, height: 640 },
  { name: '360', width: 360, height: 800 },
  { name: '390', width: 390, height: 844 },
  { name: '430', width: 430, height: 932 },
  { name: '1280', width: 1280, height: 900 },
]
const PAGES = ['/', '/local', '/online', '/regles', '/hors-connexion', '/admin']

for (const size of SIZES) {
  for (const path of PAGES) {
    test(`${path} @ ${size.name}px sans débordement`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height })
      await page.goto(path)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `débordement horizontal sur ${path}`).toBeLessThanOrEqual(1)
    })
  }
}

test('prefers-reduced-motion neutralise animations et transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const durations = await page.evaluate(() => {
    const button = document.querySelector('a[href="/local"]') as HTMLElement
    const styles = getComputedStyle(button)
    // Le navigateur exprime 0.001ms sous la forme « 1e-06s » : on compare des nombres.
    const toMs = (value: string) => Number.parseFloat(value) * 1000
    return {
      transition: toMs(styles.transitionDuration),
      animation: toMs(styles.animationDuration),
      matches: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    }
  })

  expect(durations.matches).toBe(true)
  expect(durations.transition).toBeLessThan(10)
  expect(durations.animation).toBeLessThan(10)
})
