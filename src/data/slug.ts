const DIACRITICS = /[\u0300-\u036f]/g

/** Slug stable (sans accent) utilisé comme clé d'une entrée de mot. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
