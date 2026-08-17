import { StickerBadge } from '@/components/party/sticker-badge'
import { t } from '@/i18n'
import type { Role } from '@/lib/game-engine/types'

/**
 * Pastille de rôle (affichée uniquement après révélation publique).
 * L'information n'est jamais portée par la seule couleur : le nom du rôle est
 * toujours écrit.
 */
const ROLE_TONE = {
  civilian: 'green',
  impostor: 'red',
  undercover: 'blue',
  mr_white: 'paper',
} as const

export function RoleBadge({ role }: { role: Role }) {
  return <StickerBadge tone={ROLE_TONE[role]}>{t(`role.${role}`)}</StickerBadge>
}
