export function LetterPopLogo({ className }: { className?: string }) {
  return (
    <div className={className} aria-label="LetterPop!">
      <p className="toy-title-ink -rotate-1 text-5xl uppercase leading-none sm:text-6xl">
        Letter<span className="text-red">Pop!</span>
      </p>
      <p className="mt-2 font-display text-xs font-extrabold uppercase tracking-[0.22em] text-ink-soft">
        Des mots uniques, des points magnétiques
      </p>
    </div>
  )
}
