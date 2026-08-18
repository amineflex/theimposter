import type { GameDefinition } from '@/flexgames/core/game-definition'
import { theImposter } from './the-imposter'
import { geoRush } from './geo-rush'

/**
 * Inventaire des jeux FlexGames.
 *
 * C'est le SEUL fichier à modifier pour ajouter un jeu : créer son dossier dans
 * `src/games/`, puis ajouter sa définition ici. L'ordre est celui du catalogue.
 *
 * Pour un jeu « bientôt disponible », un manifest suffit (sans `ui` ni `client`).
 */
export const GAMES: readonly GameDefinition[] = [theImposter, geoRush]
