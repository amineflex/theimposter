import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Les pages de partie sont éphémères et privées : pas d'indexation.
        disallow: ['/api/', '/admin', '/room/', '/join/', '/hors-connexion'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
