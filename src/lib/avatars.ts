/**
 * Avatars de joueurs : 16 petits blobs originaux, très simples — une tête
 * ronde, deux yeux, une bouche, et un accessoire distinctif.
 *
 * ⚠️ Les `key` sont stockées en base (`room_players.avatar_key`) : elles ne
 * doivent jamais changer. Seuls l'apparence et le libellé peuvent évoluer.
 */
export type BlobFace = 'smile' | 'grin' | 'wink' | 'tongue' | 'surprised' | 'happy'
export type BlobAccessory = 'none' | 'glasses' | 'cap' | 'antenna' | 'mustache' | 'brows' | 'bow'

export interface AvatarDefinition {
  key: string
  label: string
  /** Couleur du corps (token HSL, aplat). */
  color: string
  face: BlobFace
  accessory: BlobAccessory
}

export const AVATARS: AvatarDefinition[] = [
  { key: 'rouge-mask', label: 'Blob rouge', color: 'var(--red)', face: 'smile', accessory: 'none' },
  { key: 'ambre-eye', label: 'Blob jaune à lunettes', color: 'var(--yellow)', face: 'grin', accessory: 'glasses' },
  { key: 'violet-domino', label: 'Blob violet à casquette', color: 'var(--purple)', face: 'happy', accessory: 'cap' },
  { key: 'cyan-hood', label: 'Blob bleu à antenne', color: 'var(--blue)', face: 'surprised', accessory: 'antenna' },
  { key: 'vert-visor', label: 'Blob vert farceur', color: 'var(--green)', face: 'tongue', accessory: 'none' },
  { key: 'rose-ghost', label: 'Blob rose à nœud', color: 'var(--pink)', face: 'smile', accessory: 'bow' },
  { key: 'orange-fox', label: 'Blob orange moustachu', color: 'var(--orange)', face: 'happy', accessory: 'mustache' },
  { key: 'bleu-bandit', label: 'Blob bleu sourcilleux', color: 'var(--blue)', face: 'grin', accessory: 'brows' },
  { key: 'lime-mask', label: 'Blob vert à casquette', color: 'var(--green)', face: 'wink', accessory: 'cap' },
  { key: 'turquoise-eye', label: 'Blob rouge à lunettes', color: 'var(--red)', face: 'happy', accessory: 'glasses' },
  { key: 'indigo-domino', label: 'Blob violet à antenne', color: 'var(--purple)', face: 'smile', accessory: 'antenna' },
  { key: 'sable-hood', label: 'Blob jaune surpris', color: 'var(--yellow)', face: 'surprised', accessory: 'none' },
  { key: 'magenta-visor', label: 'Blob rose moustachu', color: 'var(--pink)', face: 'grin', accessory: 'mustache' },
  { key: 'acier-ghost', label: 'Blob crème à nœud', color: 'var(--cream-deep)', face: 'wink', accessory: 'bow' },
  { key: 'brique-fox', label: 'Blob orange à sourcils', color: 'var(--orange)', face: 'smile', accessory: 'brows' },
  { key: 'olive-bandit', label: 'Blob vert taquin', color: 'var(--green)', face: 'tongue', accessory: 'glasses' },
]

export const AVATAR_KEYS = AVATARS.map((a) => a.key)

export function getAvatar(key: string): AvatarDefinition {
  return AVATARS.find((a) => a.key === key) ?? (AVATARS[0] as AvatarDefinition)
}

/**
 * Choisit un avatar libre. Si tous sont pris (impossible en V1 : 12 joueurs
 * maximum pour 16 avatars), retombe sur un tirage aléatoire.
 */
export function pickAvatarKey(taken: readonly string[], random: () => number = Math.random): string {
  const available = AVATAR_KEYS.filter((key) => !taken.includes(key))
  const pool = available.length > 0 ? available : AVATAR_KEYS
  return pool[Math.floor(random() * pool.length)] as string
}
