/** Réactions rapides autorisées dans le chat (validées côté serveur). */
export const ALLOWED_REACTIONS = ['😂', '💀', '🤨', '👀', '🔥'] as const

export type ChatReaction = (typeof ALLOWED_REACTIONS)[number]
