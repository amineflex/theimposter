/**
 * Erreurs communes de la plateforme.
 *
 * Un module de jeu fait hériter ses propres erreurs de `GameRuleError` : le
 * gestionnaire HTTP les traduit alors automatiquement en réponse claire, sans
 * que le core connaisse la règle violée.
 */

/** Erreur métier destinée à l'utilisateur : le message est affichable tel quel. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Règle de jeu violée. Toujours un 409 : l'état ne permet pas cette action. */
export class GameRuleError extends ApiError {
  constructor(message: string, code = 'game_rule') {
    super(message, 409, code)
    this.name = 'GameRuleError'
  }
}

/** Deux transitions concurrentes : la seconde est rejetée puis rejouée. */
export class ConcurrentUpdateError extends ApiError {
  constructor(message = 'La partie a déjà avancé, réessayez.') {
    super(message, 409, 'conflict')
    this.name = 'ConcurrentUpdateError'
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string, code = 'not_found') {
    super(message, 404, code)
    this.name = 'NotFoundError'
  }
}
