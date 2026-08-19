export function LetterPopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={className} role="img" aria-label="LetterPop!">
      <rect x="9" y="22" width="42" height="48" rx="10" fill="var(--color-yellow)" stroke="var(--color-ink)" strokeWidth="5" transform="rotate(-8 30 46)" />
      <text x="30" y="56" textAnchor="middle" fontSize="31" fontWeight="900" fill="var(--color-ink)" transform="rotate(-8 30 46)">L</text>
      <rect x="45" y="27" width="42" height="48" rx="10" fill="var(--color-red)" stroke="var(--color-ink)" strokeWidth="5" transform="rotate(7 66 51)" />
      <text x="66" y="61" textAnchor="middle" fontSize="31" fontWeight="900" fill="white" transform="rotate(7 66 51)">P</text>
    </svg>
  )
}
