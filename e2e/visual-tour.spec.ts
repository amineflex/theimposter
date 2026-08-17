import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

/**
 * Tournée visuelle : parcourt les écrans clés et enregistre une capture de
 * chacun. Sert à relire le rendu réel (mobile) après une modification de design.
 *
 * Lancement : SHOTS_DIR=/chemin npx playwright test visual-tour --project=mobile
 */
const PLAYERS = ['Adam', 'Sarah', 'Rayan', 'Yanis']
const DIR = process.env.SHOTS_DIR ?? 'test-results/shots'

test.beforeAll(() => {
  mkdirSync(DIR, { recursive: true })
})

async function shot(page: Page, name: string) {
  // On laisse les animations d'entrée se terminer, sinon la capture attrape un
  // état intermédiaire (carte en cours de flip, opacité partielle…).
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: false })
}

test('tournée visuelle du mode local', async ({ page }) => {
  await page.goto('/')
  await shot(page, '01-accueil')

  await page.goto('/regles')
  await shot(page, '02-regles')

  await page.goto('/online')
  await shot(page, '03-creer-en-ligne')

  await page.goto('/local')
  const inputs = page.getByPlaceholder(/Nom du joueur/i)
  // Le formulaire démarre au minimum de joueurs : on ajoute les champs manquants.
  const existing = await inputs.count()
  for (let index = existing; index < PLAYERS.length; index++) {
    await page.getByRole('button', { name: /Ajouter un joueur/i }).click()
  }
  for (let index = 0; index < PLAYERS.length; index++) {
    await inputs.nth(index).fill(PLAYERS[index] as string)
  }
  await shot(page, '04-local-setup')

  await page.getByRole('button', { name: /Distribuer les rôles/i }).click()
  await shot(page, '05-passe-le-telephone')

  // Révélation du premier joueur.
  await page.getByRole('button', { name: /^JE SUIS / }).click()
  await shot(page, '06-maintiens-pour-voir')

  const hold = page.getByRole('button', { name: /MAINTIENS POUR VOIR/i })
  const box = await hold.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(1000)
    await page.mouse.up()
  }
  await shot(page, '07-carte-de-role')

  // On passe tous les joueurs pour atteindre la discussion.
  await page.getByRole('button', { name: /CACHER ET PASSER/i }).click()
  for (let index = 1; index < PLAYERS.length; index++) {
    await page.getByRole('button', { name: /^JE SUIS / }).click()
    const holdNext = page.getByRole('button', { name: /MAINTIENS POUR VOIR/i })
    const nextBox = await holdNext.boundingBox()
    if (nextBox) {
      await page.mouse.move(nextBox.x + nextBox.width / 2, nextBox.y + nextBox.height / 2)
      await page.mouse.down()
      await page.waitForTimeout(1000)
      await page.mouse.up()
    }
    await page.getByRole('button', { name: /CACHER ET PASSER/i }).click()
  }

  await expect(page.getByText(/Ordre de parole/i)).toBeVisible()
  await shot(page, '08-discussion')

  await page.getByRole('button', { name: /Passer au vote/i }).click()
  await shot(page, '09-passe-avant-vote')

  // Vote hot-seat : chaque joueur confirme son identité puis vote.
  for (let index = 0; index < PLAYERS.length; index++) {
    const voter = await currentHandoffName(page)
    await page.getByRole('button', { name: new RegExp(`JE SUIS ${voter}`, 'i') }).click()
    if (index === 0) await shot(page, '10-vote')

    const target = PLAYERS.find((name) => name !== voter) as string
    await page.getByRole('button', { name: `Voter contre ${target}` }).click()
    await page.getByRole('button', { name: /Confirmer mon vote/i }).click()
  }

  await expect(page.getByRole('heading', { name: /votes sont faits/i })).toBeVisible()
  await shot(page, '11-resultat-du-vote')

  await page.getByRole('button', { name: /Continuer/i }).click()
  await page.waitForTimeout(2600)
  await shot(page, '12-elimination')

  // Enchaîne jusqu'à un écran de fin ou un nouveau tour.
  const continueButton = page.getByRole('button', { name: /Continuer/i })
  if (await continueButton.count()) await continueButton.click()
  await page.waitForTimeout(1200)
  await shot(page, '13-suite')

  // Poursuit la partie jusqu'à l'écran de victoire.
  const replay = page.getByRole('button', { name: /Rejouer/i })
  let guard = 0
  while ((await replay.count()) === 0 && guard++ < 12) {
    const toVote = page.getByRole('button', { name: /Passer au vote/i })
    if (await toVote.count()) await toVote.click()

    const handoff = page.getByRole('button', { name: /^JE SUIS / })
    if (await handoff.count()) {
      const voter = await currentHandoffName(page)
      await handoff.click()
      const target = PLAYERS.find((name) => name !== voter) as string
      const tile = page.getByRole('button', { name: `Voter contre ${target}` })
      if (await tile.count()) {
        await tile.click()
        await page.getByRole('button', { name: /Confirmer mon vote/i }).click()
      }
      continue
    }

    const next = page.getByRole('button', { name: /Continuer/i })
    if (await next.count()) {
      await next.click()
      await page.waitForTimeout(2400)
      continue
    }

    // Mr. White doit deviner : on propose une réponse volontairement fausse.
    const guessField = page.getByLabel(/Devine le mot/i)
    if (await guessField.count()) {
      await guessField.fill('Chaussure')
      await page.getByRole('button', { name: /CONFIRMER/i }).click()
      await page.waitForTimeout(1200)
      continue
    }
    break
  }

  if (await replay.count()) await shot(page, '14-victoire')
})

/**
 * À 3 joueurs (2 civils + 1 intrus), une seule élimination termine forcément la
 * partie : c'est le chemin le plus court vers l'écran de fin.
 */
test('tournée visuelle  ·  écran de fin', async ({ page }) => {
  const trio = ['Adam', 'Sarah', 'Rayan']
  await page.goto('/local')
  const inputs = page.getByPlaceholder(/Nom du joueur/i)
  for (let index = 0; index < trio.length; index++) {
    await inputs.nth(index).fill(trio[index] as string)
  }
  await page.getByRole('button', { name: /Distribuer les rôles/i }).click()

  for (let index = 0; index < trio.length; index++) {
    await page.getByRole('button', { name: /^JE SUIS / }).click()
    const hold = page.getByRole('button', { name: /MAINTIENS POUR VOIR/i })
    const box = await hold.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.waitForTimeout(900)
      await page.mouse.up()
    }
    await page.getByRole('button', { name: /CACHER ET PASSER/i }).click()
  }

  await page.getByRole('button', { name: /Passer au vote/i }).click()

  for (let index = 0; index < trio.length; index++) {
    const button = page.getByRole('button', { name: /^JE SUIS / })
    const label = ((await button.textContent()) ?? '').replace(/^JE SUIS\s+/i, '').trim()
    const voter = trio.find((name) => name.toUpperCase() === label) ?? label
    await button.click()
    const target = trio.find((name) => name !== voter) as string
    await page.getByRole('button', { name: `Voter contre ${target}` }).click()
    await page.getByRole('button', { name: /Confirmer mon vote/i }).click()
  }

  await page.getByRole('button', { name: /Continuer/i }).click()
  await page.waitForTimeout(2600)
  const nextButton = page.getByRole('button', { name: /Continuer/i })
  if (await nextButton.count()) await nextButton.click()

  // Mr. White peut avoir une dernière chance : réponse volontairement fausse.
  const guessField = page.getByLabel(/Devine le mot/i)
  if (await guessField.count()) {
    await guessField.fill('Chaussure')
    await page.getByRole('button', { name: /^CONFIRMER$/i }).click()
    await page.waitForTimeout(1500)
  }

  await expect(page.getByRole('button', { name: /Rejouer/i })).toBeVisible()
  await shot(page, '15-fin-de-partie')
})

/** Nom lu depuis le bouton « JE SUIS … » de l'écran de passage d'appareil. */
async function currentHandoffName(page: Page): Promise<string> {
  const button = page.getByRole('button', { name: /^JE SUIS / })
  await expect(button).toBeVisible()
  const label = ((await button.textContent()) ?? '').replace(/^JE SUIS\s+/i, '').trim()
  return PLAYERS.find((player) => player.toUpperCase() === label) ?? label
}
