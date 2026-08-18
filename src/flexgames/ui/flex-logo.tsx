import { cn } from '@/lib/utils'

/**
 * Logo FlexGames : deux mots empilés, cernés d'un trait épais, posés de travers
 * comme un autocollant. Aucun dégradé, aucune lueur  ·  juste des aplats.
 */
export function FlexLogo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex flex-col items-center', className)} role="img" aria-label="FlexGames">
      <span className="toy-title -rotate-2 rounded-blob border-4 border-ink bg-red px-5 py-1.5 text-4xl leading-none text-paper shadow-toy-lg sm:text-5xl">
        FLEX
      </span>
      <span className="toy-title-ink -mt-2 rotate-2 rounded-blob border-4 border-ink bg-yellow px-5 py-1.5 text-4xl leading-none shadow-toy-lg sm:text-5xl">
        GAMES
      </span>
    </span>
  )
}
