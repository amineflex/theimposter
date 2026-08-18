export function GeoRushIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="GeoRush">
      <circle cx="32" cy="32" r="26" fill="var(--color-blue)" stroke="var(--color-ink)" strokeWidth="4" />
      <path d="M12 26l9-8 8 3 4 9-5 5-9-2zm25-15 10 7-2 8 7 7-5 12-10 4-3-10 6-6-6-8z" fill="var(--color-green)" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M9 33h46M32 7c-8 7-11 16-11 25s3 18 11 25M32 7c8 7 11 16 11 25s-3 18-11 25" fill="none" stroke="var(--color-ink)" strokeWidth="2" opacity=".6" />
    </svg>
  )
}
