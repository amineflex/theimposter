import { fr, type TranslationKey } from './fr'

/**
 * i18n minimaliste, sans dépendance.
 *
 * V1 : français uniquement. Pour ajouter une langue, créer `en.ts` avec les
 * mêmes clés, l'enregistrer dans `DICTIONARIES`, puis exposer un sélecteur de
 * langue : aucun composant n'a besoin d'être modifié.
 */
export const DEFAULT_LOCALE = 'fr'

export const DICTIONARIES = {
  fr,
} satisfies Record<string, Record<TranslationKey, string>>

export type Locale = keyof typeof DICTIONARIES

export type TranslationValues = Record<string, string | number>

/**
 * Traduit une clé, avec interpolation `{nom}`.
 * En cas de clé absente, renvoie la clé : le manque est visible et non silencieux.
 */
export function t(key: TranslationKey, values?: TranslationValues, locale: Locale = DEFAULT_LOCALE): string {
  const dictionary = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE]
  const template: string = dictionary[key] ?? key
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name]
    return value === undefined ? match : String(value)
  })
}

export type { TranslationKey }
