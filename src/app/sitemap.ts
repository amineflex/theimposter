import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: siteUrl, lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: `${siteUrl}/local`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${siteUrl}/online`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${siteUrl}/regles`, lastModified, changeFrequency: 'yearly', priority: 0.6 },
  ]
}
