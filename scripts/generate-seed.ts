/**
 * Génère `supabase/seed.sql` à partir de la base de mots TypeScript.
 *
 * La base de mots est écrite une seule fois (src/data/*.ts) puis utilisée :
 *  - par le mode local offline (import direct dans le bundle),
 *  - par ce script pour produire le seed SQL du mode en ligne.
 *
 * Usage : npm run seed:generate
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { IMPOSTOR_WORDS } from '../src/games/the-imposter/data/impostor-words'
import { PACKS } from '../src/games/the-imposter/data/packs'
import { slugify } from '../src/games/the-imposter/data/slug'
import { WORD_PAIRS } from '../src/games/the-imposter/data/word-pairs'

function q(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function arr(values: readonly string[]): string {
  if (values.length === 0) return `'{}'`
  return `array[${values.map(q).join(', ')}]::text[]`
}

const categories = Array.from(
  new Set([...IMPOSTOR_WORDS.map((w) => w.category), ...WORD_PAIRS.map((p) => p.category)]),
).sort()

const lines: string[] = []

lines.push('-- ===========================================================================')
lines.push('-- The Imposter  ·  seed de la base de mots (FRANÇAIS)')
lines.push('--')
lines.push('-- FICHIER GÉNÉRÉ AUTOMATIQUEMENT  ·  ne pas éditer à la main.')
lines.push('-- Source : src/data/impostor-words.ts, src/data/word-pairs.ts, src/data/packs.ts')
lines.push('-- Régénérer avec : npm run seed:generate')
lines.push('--')
lines.push(`-- Catégories : ${categories.length}`)
lines.push(`-- Packs : ${PACKS.length}`)
lines.push(`-- Mots mode Imposteur : ${IMPOSTOR_WORDS.length}`)
lines.push(`-- Paires mode Undercover : ${WORD_PAIRS.length}`)
lines.push(`-- Total entrées jouables : ${IMPOSTOR_WORDS.length + WORD_PAIRS.length}`)
lines.push('-- ===========================================================================')
lines.push('')
lines.push('begin;')
lines.push('')

lines.push('-- --- Catégories ------------------------------------------------------------')
lines.push('insert into categories (slug, name) values')
lines.push(
  categories.map((name) => `  (${q(slugify(name))}, ${q(name)})`).join(',\n') +
    '\non conflict (slug) do update set name = excluded.name;',
)
lines.push('')

lines.push('-- --- Packs -----------------------------------------------------------------')
lines.push('insert into packs (slug, name, description, emoji, sort_order) values')
lines.push(
  PACKS.map(
    (p) => `  (${q(p.slug)}, ${q(p.name)}, ${q(p.description)}, ${q(p.emoji)}, ${p.sort})`,
  ).join(',\n') +
    `\non conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  emoji = excluded.emoji,
  sort_order = excluded.sort_order;`,
)
lines.push('')

lines.push('-- --- Mots du mode Imposteur ------------------------------------------------')
lines.push(
  'insert into impostor_words (slug, word, hint, category_id, difficulty, accepted_answers) values',
)
lines.push(
  IMPOSTOR_WORDS.map(
    (w) =>
      `  (${q(w.id)}, ${q(w.word)}, ${q(w.hint)}, (select id from categories where slug = ${q(
        slugify(w.category),
      )}), ${q(w.difficulty)}::difficulty_level, ${arr(w.acceptedAnswers ?? [])})`,
  ).join(',\n') +
    `\non conflict (slug) do update set
  word = excluded.word,
  hint = excluded.hint,
  category_id = excluded.category_id,
  difficulty = excluded.difficulty,
  accepted_answers = excluded.accepted_answers,
  updated_at = now();`,
)
lines.push('')

lines.push('-- --- Paires du mode Undercover ---------------------------------------------')
lines.push(
  'insert into word_pairs (slug, civilian_word, undercover_word, category_id, difficulty, accepted_answers) values',
)
lines.push(
  WORD_PAIRS.map(
    (p) =>
      `  (${q(p.id)}, ${q(p.civilianWord)}, ${q(p.undercoverWord)}, (select id from categories where slug = ${q(
        slugify(p.category),
      )}), ${q(p.difficulty)}::difficulty_level, ${arr(p.acceptedAnswers ?? [])})`,
  ).join(',\n') +
    `\non conflict (slug) do update set
  civilian_word = excluded.civilian_word,
  undercover_word = excluded.undercover_word,
  category_id = excluded.category_id,
  difficulty = excluded.difficulty,
  accepted_answers = excluded.accepted_answers,
  updated_at = now();`,
)
lines.push('')

lines.push('-- --- Rattachement aux packs ------------------------------------------------')
const wordLinks = IMPOSTOR_WORDS.flatMap((w) => w.packs.map((pack) => [pack, w.id] as const))
lines.push('insert into pack_impostor_words (pack_id, word_id) values')
lines.push(
  wordLinks
    .map(
      ([pack, word]) =>
        `  ((select id from packs where slug = ${q(pack)}), (select id from impostor_words where slug = ${q(word)}))`,
    )
    .join(',\n') + '\non conflict do nothing;',
)
lines.push('')

const pairLinks = WORD_PAIRS.flatMap((p) => p.packs.map((pack) => [pack, p.id] as const))
lines.push('insert into pack_word_pairs (pack_id, pair_id) values')
lines.push(
  pairLinks
    .map(
      ([pack, pair]) =>
        `  ((select id from packs where slug = ${q(pack)}), (select id from word_pairs where slug = ${q(pair)}))`,
    )
    .join(',\n') + '\non conflict do nothing;',
)
lines.push('')

lines.push('-- --- Réglages applicatifs par défaut --------------------------------------')
lines.push(`insert into app_settings (key, value) values
  ('room_expiry_hours', '6'::jsonb),
  ('chat_enabled', 'true'::jsonb),
  ('public_rooms_enabled', 'true'::jsonb),
  ('max_rooms_per_hour', '10'::jsonb)
on conflict (key) do nothing;`)
lines.push('')
lines.push('commit;')
lines.push('')

const target = resolve(import.meta.dirname, '../supabase/seed.sql')
writeFileSync(target, lines.join('\n'), 'utf8')

console.log(`seed.sql généré : ${target}`)
console.log(
  `  ${categories.length} catégories, ${PACKS.length} packs, ${IMPOSTOR_WORDS.length} mots imposteur, ${WORD_PAIRS.length} paires undercover (total ${IMPOSTOR_WORDS.length + WORD_PAIRS.length})`,
)
