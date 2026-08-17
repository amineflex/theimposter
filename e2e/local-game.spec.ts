import { expect, test, type Page } from '@playwright/test'

/**
 * Parcours complet d'une partie locale : accueil → joueurs → distribution des
 * rôles (passage du téléphone) → descriptions → vote → élimination.
 */

const PLAYERS = ['Adam', 'Sarah', 'Rayan', 'Yanis']

test.describe('mode local', () => {
  test("depuis l'accueil, on atteint l'écran de configuration locale", async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/imposter/i)
    await page.getByRole('link', { name: /Partie locale/i }).click()
    await expect(page.getByRole('heading', { name: 'Partie locale' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Distribuer les rôles/i })).toBeVisible()
  })

  test('le lancement est bloqué avec moins de 3 joueurs', async ({ page }) => {
    await page.goto('/local')
    await fillPlayers(page, ['Adam'])
    await expect(page.getByRole('button', { name: /Distribuer les rôles/i })).toBeDisabled()
    await expect(page.getByText(/Ajoutez au moins 3 joueurs/i)).toBeVisible()
  })

  test('deux joueurs de même nom sont refusés', async ({ page }) => {
    await page.goto('/local')
    await fillPlayers(page, ['Adam', 'Adam', 'Rayan'])
    await expect(page.getByText(/même nom/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Distribuer les rôles/i })).toBeDisabled()
  })

  test('une partie va de la distribution des rôles au vote', async ({ page }) => {
    await page.goto('/local')
    await fillPlayers(page, PLAYERS)
    await page.getByRole('button', { name: /Distribuer les rôles/i }).click()

    // Distribution : chaque joueur confirme son identité, maintient pour révéler,
    // puis masque avant de passer l'appareil.
    for (let index = 0; index < PLAYERS.length; index++) {
      const name = await currentHandoffName(page)
      expect(PLAYERS).toContain(name)
      await page.getByRole('button', { name: new RegExp(`JE SUIS ${name}`, 'i') }).click()

      const holdButton = page.getByRole('button', { name: /MAINTIENS POUR VOIR/i })
      await expect(holdButton).toBeVisible()
      await holdRevealButton(page, holdButton)

      // Le rôle est affiché : Civil, Undercover ou Mr. White.
      await expect(page.getByText(/CIVIL|UNDERCOVER|MR\. WHITE/i).first()).toBeVisible()
      await page.getByRole('button', { name: /CACHER ET PASSER/i }).click()

      // Régression : aucune carte de rôle ne doit subsister après le passage du
      // téléphone (sinon le mot du joueur suivant apparaîtrait brièvement).
      await expect(page.getByText(/TON MOT|TON INDICE/i)).toHaveCount(0)
    }

    // Phase de descriptions.
    await expect(page.getByRole('heading', { name: /de jouer/i })).toBeVisible()
    await expect(page.getByText(/Ordre de parole/i)).toBeVisible()

    // On coupe court à la discussion pour aller au vote.
    await page.getByRole('button', { name: /Passer au vote/i }).click()

    // Vote hot-seat : chaque joueur vivant vote à son tour.
    for (let index = 0; index < PLAYERS.length; index++) {
      const voterName = await currentHandoffName(page)
      await page.getByRole('button', { name: new RegExp(`JE SUIS ${voterName}`, 'i') }).click()

      // Voter contre le premier autre joueur (on ne peut pas voter pour soi).
      const target = PLAYERS.find((name) => name !== voterName) as string
      await page.getByRole('button', { name: `Voter contre ${target}` }).click()
      await page.getByRole('button', { name: /Confirmer mon vote/i }).click()
    }

    // Résultat du scrutin puis élimination.
    await expect(page.getByRole('heading', { name: /votes sont faits/i })).toBeVisible()
    await expect(page.getByText(/Détail des votes/i)).toBeVisible()
    await page.getByRole('button', { name: /Continuer/i }).click()
    await expect(page.getByText(/est éliminé|Aucun vote exprimé/i).first()).toBeVisible()
  })

  test('le mode local est accessible sans réseau (page hors connexion)', async ({ page }) => {
    await page.goto('/hors-connexion')
    await expect(page.getByRole('heading', { name: /hors connexion/i })).toBeVisible()
    await expect(page.getByText('Mode local', { exact: true })).toBeVisible()
    await expect(page.getByText('Mode en ligne', { exact: true })).toBeVisible()
    await expect(page.getByText('disponible', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: /Partie locale/i }).click()
    await expect(page.getByRole('heading', { name: 'Partie locale' })).toBeVisible()
  })
})

/**
 * Nom du joueur attendu sur un écran de passage d'appareil, lu depuis le bouton
 * « JE SUIS … » (plus robuste qu'un titre pendant les transitions animées).
 */
async function currentHandoffName(page: Page): Promise<string> {
  const button = page.getByRole('button', { name: /^JE SUIS / })
  await expect(button).toBeVisible()
  const label = (await button.textContent()) ?? ''
  const name = label.replace(/^JE SUIS\s+/i, '').trim()
  // Les noms sont affichés en majuscules dans le bouton : on retrouve la casse.
  return PLAYERS.find((player) => player.toUpperCase() === name) ?? name
}

async function fillPlayers(page: Page, names: string[]) {
  // Le formulaire démarre avec 4 champs ; on en ajoute au besoin.
  const inputs = page.getByPlaceholder(/Nom du joueur/i)
  const existing = await inputs.count()
  for (let index = existing; index < names.length; index++) {
    await page.getByRole('button', { name: /Ajouter un joueur/i }).click()
  }
  for (let index = 0; index < names.length; index++) {
    await inputs.nth(index).fill(names[index] as string)
  }
  // Vider les champs excédentaires pour ne compter que les joueurs voulus.
  const total = await inputs.count()
  for (let index = names.length; index < total; index++) {
    await inputs.nth(index).fill('')
  }
}

/** Simule l'appui maintenu nécessaire à la révélation d'un rôle. */
async function holdRevealButton(page: Page, locator: ReturnType<Page['getByRole']>) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Bouton de révélation introuvable')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(1000)
  await page.mouse.up()
}
