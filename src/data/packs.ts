/** Packs de mots officiels. Le slug est la clé stable utilisée partout. */
export interface PackDefinition {
  slug: string
  name: string
  description: string
  /** Ordre d'affichage dans l'UI. */
  sort: number
  emoji: string
}

export const PACKS: PackDefinition[] = [
  {
    slug: 'classique',
    name: 'Classique',
    description: 'Les incontournables : objets, animaux, lieux du quotidien.',
    sort: 1,
    emoji: '🎯',
  },
  {
    slug: 'nourriture',
    name: 'Nourriture',
    description: 'Plats, boissons, desserts et fast-food.',
    sort: 2,
    emoji: '🍕',
  },
  { slug: 'animaux', name: 'Animaux', description: 'De la fourmi à la baleine.', sort: 3, emoji: '🦁' },
  {
    slug: 'monde',
    name: 'Monde',
    description: 'Villes, monuments, paysages et lieux célèbres.',
    sort: 4,
    emoji: '🌍',
  },
  { slug: 'gaming', name: 'Gaming', description: 'Jeux vidéo, consoles et culture geek.', sort: 5, emoji: '🎮' },
  {
    slug: 'films-series',
    name: 'Films & séries',
    description: 'Cinéma, séries, animation et mangas.',
    sort: 6,
    emoji: '🎬',
  },
  { slug: 'sport', name: 'Sport', description: 'Disciplines, compétitions et loisirs actifs.', sort: 7, emoji: '⚽' },
  {
    slug: 'difficile',
    name: 'Difficile',
    description: 'Notions abstraites et mots qui font transpirer.',
    sort: 8,
    emoji: '🧠',
  },
  {
    slug: 'fun',
    name: 'Fun',
    description: 'Tendances, réseaux sociaux et situations de la vraie vie.',
    sort: 9,
    emoji: '😂',
  },
  {
    slug: 'france-belgique',
    name: 'France / Belgique',
    description: 'Culture, spécialités et références franco-belges.',
    sort: 10,
    emoji: '🥐',
  },
]

export const PACK_SLUGS = PACKS.map((p) => p.slug)

/** Catégories utilisées par les entrées (affichage et filtres admin). */
export const CATEGORIES = [
  'Animaux',
  'Nourriture',
  'Boissons',
  'Objets',
  'Vêtements',
  'Technologie',
  'Lieux',
  'Monuments',
  'Transport',
  'Sport',
  'Gaming',
  'Films & séries',
  'Musique',
  'Métiers',
  'Nature',
  'Fêtes & événements',
  'Vie quotidienne',
  'Abstrait',
  'Culture FR/BE',
] as const

export type CategoryName = (typeof CATEGORIES)[number]
