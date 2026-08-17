import type { Metadata, Viewport } from 'next'
import { Baloo_2, Nunito } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
import { OfflineBanner } from '@/components/layout/offline-banner'
import { ScatteredShapes } from '@/components/party/decor'
import { ServiceWorkerRegistrar } from '@/components/layout/service-worker-registrar'
import { t } from '@/i18n'

/** Police d'affichage : massive et arrondie, pour les titres et les boutons. */
const display = Baloo_2({
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700', '800'],
  variable: '--font-display-family',
  display: 'swap',
})

/** Police de texte : très lisible pour les réglages et les explications. */
const sans = Nunito({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-sans-family',
  display: 'swap',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'The Imposter — party game de déduction',
    template: '%s · The Imposter',
  },
  description: `${t('app.description')} — by amineflex`,
  applicationName: 'The Imposter',
  authors: [{ name: 'amineflex', url: 'https://amineflex.is-a.dev' }],
  creator: 'amineflex',
  publisher: 'amineflex',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'The Imposter',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192' }],
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: siteUrl,
    siteName: 'The Imposter',
    title: 'The Imposter — party game de déduction',
    description: t('app.description'),
    images: [{ url: '/icons/og.png', width: 1200, height: 630, alt: 'The Imposter' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Imposter',
    description: t('app.description'),
    images: ['/icons/og.png'],
  },
  keywords: ['party game', 'jeu de déduction', 'imposteur', 'undercover', 'mr white', 'jeu entre amis'],
}

export const viewport: Viewport = {
  themeColor: '#FFF8E7',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  // Le zoom reste autorisé (accessibilité) ; les champs sont en 16px pour
  // éviter le zoom automatique iOS.
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${display.variable} ${sans.variable} min-h-dvh font-sans`}>
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Aller au contenu
        </a>
        <OfflineBanner />
        <ScatteredShapes />
        <div
          id="contenu"
          className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col px-4 safe-top safe-bottom"
        >
          {children}
        </div>
        <Toaster
          theme="light"
          position="top-center"
          toastOptions={{
            style: {
              background: 'var(--color-paper)',
              color: 'var(--color-ink)',
              border: '3px solid var(--color-ink)',
              borderRadius: '1.25rem',
              boxShadow: '0 5px 0 var(--color-ink)',
              fontWeight: 700,
            },
          }}
        />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
