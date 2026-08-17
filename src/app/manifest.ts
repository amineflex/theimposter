import type { MetadataRoute } from 'next'

/** Manifeste PWA : installation sur l'écran d'accueil, démarrage plein écran. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'The Imposter — party game de déduction',
    short_name: 'The Imposter',
    description:
      "Trouve l'intrus. Ou deviens-le. Party game social de déduction, en local sur un téléphone ou en ligne entre amis.",
    lang: 'fr',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFF8E7',
    theme_color: '#FFF8E7',
    categories: ['games', 'entertainment', 'social'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Partie locale', short_name: 'Local', url: '/local' },
      { name: 'Partie en ligne', short_name: 'En ligne', url: '/online' },
      { name: 'Comment jouer', short_name: 'Règles', url: '/regles' },
    ],
  }
}
