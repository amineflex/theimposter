import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Administration',
  robots: { index: false, follow: false },
}

/**
 * L'administration reste volontairement classique (pas de party game) et sort du
 * cadre central étroit du jeu pour laisser respirer les tableaux.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-[calc(50%-50vw)] w-screen px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </div>
  )
}
