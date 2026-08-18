/**
 * Pictogramme du jeu pour le catalogue : un œil qui observe, dans le langage
 * plat/cerné du design system (pas d'emoji, pas de dégradé).
 */
export function ImposterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="The Imposter">
      <ellipse
        cx="32"
        cy="32"
        rx="27"
        ry="18"
        fill="var(--color-paper)"
        stroke="var(--color-ink)"
        strokeWidth="4"
      />
      <circle cx="32" cy="32" r="12" fill="var(--color-red)" stroke="var(--color-ink)" strokeWidth="4" />
      <circle cx="32" cy="32" r="4.5" fill="var(--color-ink)" />
      <circle cx="27" cy="27" r="2.5" fill="var(--color-paper)" />
      <path
        d="M8 20 Q32 6 56 20"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}
