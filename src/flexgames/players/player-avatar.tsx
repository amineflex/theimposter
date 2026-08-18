import { getAvatar, type BlobAccessory, type BlobFace } from '@/flexgames/players/avatars'
import { cn } from '@/lib/utils'

const SIZES = {
  xs: 30,
  sm: 38,
  md: 50,
  lg: 74,
  xl: 116,
} as const

export interface PlayerAvatarProps {
  avatarKey: string
  name: string
  size?: keyof typeof SIZES
  className?: string
  /** Grise l'avatar (joueur éliminé). */
  dimmed?: boolean
}

const INK = 'var(--color-ink)'
const PAPER = 'var(--color-paper)'

/**
 * Avatar : un blob tout simple, en aplat, avec contour d'encre.
 * Dessiné en SVG (aucune ressource externe : fonctionne hors connexion).
 */
export function PlayerAvatar({ avatarKey, name, size = 'md', className, dimmed }: PlayerAvatarProps) {
  const avatar = getAvatar(avatarKey)
  const px = SIZES[size]

  return (
    <span
      className={cn('relative inline-block shrink-0', dimmed && 'opacity-45 grayscale', className)}
      style={{ width: px, height: px }}
      role="img"
      aria-label={`Avatar de ${name}`}
    >
      <svg viewBox="0 0 64 64" width={px} height={px} aria-hidden focusable="false">
        {/* Corps : blob légèrement irrégulier, jamais un cercle parfait. */}
        <path
          d="M32 5c14 0 24 9.6 24 22.5 0 5-1.4 8.6-1.4 12.2 0 7.6-9 14.3-22.6 14.3S9.4 47.3 9.4 39.7C9.4 36.1 8 32.5 8 27.5C8 14.6 18 5 32 5z"
          fill={avatar.color}
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <Face face={avatar.face} />
        <Accessory accessory={avatar.accessory} color={avatar.color} />
      </svg>
    </span>
  )
}

function Face({ face }: { face: BlobFace }) {
  const eye = (cx: number, cy: number, closed = false) =>
    closed ? (
      <path
        d={`M${cx - 4} ${cy}q4 3.4 8 0`}
        stroke={INK}
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
    ) : (
      <g>
        <ellipse cx={cx} cy={cy} rx="5" ry="6" fill={PAPER} stroke={INK} strokeWidth="2.4" />
        <circle cx={cx + 0.8} cy={cy + 1} r="2.4" fill={INK} />
      </g>
    )

  switch (face) {
    case 'grin':
      return (
        <g>
          {eye(24, 29)}
          {eye(41, 29)}
          <path
            d="M23 41c4.5 6 13.5 6 18 0z"
            fill={INK}
            stroke={INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </g>
      )
    case 'wink':
      return (
        <g>
          {eye(24, 29, true)}
          {eye(41, 29)}
          <path d="M25 42c4 3.6 10 3.6 14 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      )
    case 'tongue':
      return (
        <g>
          {eye(24, 29)}
          {eye(41, 29)}
          <path d="M24 41c4 4.4 12 4.4 16 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path
            d="M29 44h7c0 4-1.6 6-3.5 6S29 48 29 44z"
            fill="var(--color-pink)"
            stroke={INK}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </g>
      )
    case 'surprised':
      return (
        <g>
          {eye(24, 28)}
          {eye(41, 28)}
          <ellipse cx="32" cy="43" rx="4.5" ry="5" fill={INK} />
        </g>
      )
    case 'happy':
      return (
        <g>
          {eye(24, 29, true)}
          {eye(41, 29, true)}
          <path d="M24 40c4 5 12 5 16 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      )
    default:
      // 'smile'
      return (
        <g>
          {eye(24, 29)}
          {eye(41, 29)}
          <path d="M26 42c3.4 3 8.6 3 12 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      )
  }
}

function Accessory({ accessory, color }: { accessory: BlobAccessory; color: string }) {
  switch (accessory) {
    case 'glasses':
      return (
        <g fill="none" stroke={INK} strokeWidth="2.6">
          <circle cx="24" cy="29" r="8.5" />
          <circle cx="41" cy="29" r="8.5" />
          <path d="M32.5 28h0.5" strokeWidth="3" />
          <path d="M15.5 27l-5-3M49.5 27l5-3" strokeLinecap="round" />
        </g>
      )
    case 'cap':
      return (
        <g>
          <path
            d="M11 20c2-9 10-14 21-14s19 5 21 14z"
            fill="var(--color-blue)"
            stroke={INK}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M11 20h-6c0-3 2-5 6-5z"
            fill="var(--color-blue)"
            stroke={INK}
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="7" r="3" fill="var(--color-yellow)" stroke={INK} strokeWidth="2.2" />
        </g>
      )
    case 'antenna':
      return (
        <g>
          <path d="M32 6V-1" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="1" r="4.5" fill="var(--color-yellow)" stroke={INK} strokeWidth="2.6" />
        </g>
      )
    case 'mustache':
      return (
        <path
          d="M32 37c-2-3-7-4-9-1 2 3 6 3.6 9 1zm0 0c2-3 7-4 9-1-2 3-6 3.6-9 1z"
          fill={INK}
        />
      )
    case 'brows':
      return (
        <g stroke={INK} strokeWidth="3.4" strokeLinecap="round">
          <path d="M18 19l11 3" />
          <path d="M46 19l-11 3" />
        </g>
      )
    case 'bow':
      return (
        <g>
          <path
            d="M46 12l8-5 1 10z"
            fill="var(--color-red)"
            stroke={INK}
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            d="M46 12l9 4-8 5z"
            fill="var(--color-red)"
            stroke={INK}
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <circle cx="47.5" cy="14" r="2.6" fill={color} stroke={INK} strokeWidth="2" />
        </g>
      )
    default:
      return null
  }
}
