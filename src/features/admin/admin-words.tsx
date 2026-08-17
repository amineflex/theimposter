'use client'

import * as React from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, LoadingState } from '@/components/game/states'
import { api, describeError } from '@/lib/api/client'
import { PACKS } from '@/data/packs'
import { DIFFICULTIES, type Difficulty } from '@/lib/game-engine/types'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

type Kind = 'impostor' | 'pair'

interface WordItem {
  id: string
  slug: string
  word?: string
  hint?: string
  civilian_word?: string
  undercover_word?: string
  difficulty: Difficulty
  accepted_answers: string[]
  is_active: boolean
  categories: { id: string; name: string } | null
  pack_links: { packs: { slug: string; name: string } | null }[]
}

interface FormState {
  id: string | null
  word: string
  hint: string
  civilianWord: string
  undercoverWord: string
  category: string
  difficulty: Difficulty
  packs: string[]
  acceptedAnswers: string
  isActive: boolean
}

const EMPTY_FORM: FormState = {
  id: null,
  word: '',
  hint: '',
  civilianWord: '',
  undercoverWord: '',
  category: '',
  difficulty: 'medium',
  packs: [],
  acceptedAnswers: '',
  isActive: true,
}

/** CRUD complet de la base de mots. */
export function AdminWords() {
  const [kind, setKind] = React.useState<Kind>('pair')
  const [items, setItems] = React.useState<WordItem[] | null>(null)
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(0)
  const [search, setSearch] = React.useState('')
  const [difficulty, setDifficulty] = React.useState<Difficulty | ''>('')
  const [pack, setPack] = React.useState('')
  const [form, setForm] = React.useState<FormState | null>(null)
  const [saving, setSaving] = React.useState(false)

  const load = React.useCallback(async () => {
    const params = new URLSearchParams({ kind, page: String(page), pageSize: '25' })
    if (search) params.set('search', search)
    if (difficulty) params.set('difficulty', difficulty)
    if (pack) params.set('pack', pack)
    try {
      const result = await api.get<{ items: WordItem[]; total: number }>(
        `/api/admin/words?${params.toString()}`,
      )
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      toast.error(describeError(error, 'Chargement impossible.'))
      setItems([])
    }
  }, [kind, page, search, difficulty, pack])

  // Rechargement à chaque changement de filtre : l'écriture d'état a lieu après
  // l'`await`, jamais dans le corps de l'effet.
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const params = new URLSearchParams({ kind, page: String(page), pageSize: '25' })
      if (search) params.set('search', search)
      if (difficulty) params.set('difficulty', difficulty)
      if (pack) params.set('pack', pack)
      try {
        const result = await api.get<{ items: WordItem[]; total: number }>(
          `/api/admin/words?${params.toString()}`,
        )
        if (cancelled) return
        setItems(result.items)
        setTotal(result.total)
      } catch (error) {
        if (cancelled) return
        toast.error(describeError(error, 'Chargement impossible.'))
        setItems([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [kind, page, search, difficulty, pack])

  const save = async () => {
    if (!form) return
    setSaving(true)
    const acceptedAnswers = form.acceptedAnswers
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
    const data =
      kind === 'impostor'
        ? {
            word: form.word,
            hint: form.hint,
            category: form.category,
            difficulty: form.difficulty,
            packs: form.packs,
            acceptedAnswers,
            isActive: form.isActive,
          }
        : {
            civilianWord: form.civilianWord,
            undercoverWord: form.undercoverWord,
            category: form.category,
            difficulty: form.difficulty,
            packs: form.packs,
            acceptedAnswers,
            isActive: form.isActive,
          }

    try {
      if (form.id) await api.patch('/api/admin/words', { kind, id: form.id, data })
      else await api.post('/api/admin/words', { kind, data })
      toast.success('Entrée enregistrée.')
      setForm(null)
      await load()
    } catch (error) {
      toast.error(describeError(error, "Enregistrement impossible."))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (item: WordItem) => {
    try {
      await api.patch('/api/admin/words', { kind, id: item.id, data: { isActive: !item.is_active } })
      await load()
    } catch (error) {
      toast.error(describeError(error, 'Modification impossible.'))
    }
  }

  const remove = async (item: WordItem) => {
    if (!window.confirm('Supprimer définitivement cette entrée ?')) return
    try {
      await api.delete('/api/admin/words', { kind, id: item.id })
      await load()
    } catch (error) {
      toast.error(describeError(error, 'Suppression impossible.'))
    }
  }

  const openEdit = (item: WordItem) =>
    setForm({
      id: item.id,
      word: item.word ?? '',
      hint: item.hint ?? '',
      civilianWord: item.civilian_word ?? '',
      undercoverWord: item.undercover_word ?? '',
      category: item.categories?.name ?? '',
      difficulty: item.difficulty,
      packs: item.pack_links.map((link) => link.packs?.slug).filter((slug): slug is string => Boolean(slug)),
      acceptedAnswers: item.accepted_answers.join(', '),
      isActive: item.is_active,
    })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['pair', 'impostor'] as const).map((value) => (
          <Button
            key={value}
            variant={kind === value ? 'default' : 'secondary'}
            size="sm"
            onClick={() => {
              setKind(value)
              setPage(0)
            }}
          >
            {value === 'pair' ? t('mode.undercover') : t('mode.impostor')}
          </Button>
        ))}
        <Button size="sm" className="ml-auto" onClick={() => setForm({ ...EMPTY_FORM })}>
          <Plus className="h-4 w-4" aria-hidden />
          Ajouter
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(0)
          }}
          placeholder="Rechercher un mot…"
          aria-label="Rechercher"
        />
        <select
          value={difficulty}
          onChange={(event) => {
            setDifficulty(event.target.value as Difficulty | '')
            setPage(0)
          }}
          aria-label={t('create.difficulty')}
          className="h-12 rounded-lg border border-input bg-secondary/40 px-3 text-base"
        >
          <option value="">Toutes difficultés</option>
          {DIFFICULTIES.map((value) => (
            <option key={value} value={value}>
              {t(`difficulty.${value}`)}
            </option>
          ))}
        </select>
        <select
          value={pack}
          onChange={(event) => {
            setPack(event.target.value)
            setPage(0)
          }}
          aria-label={t('create.packs')}
          className="h-12 rounded-lg border border-input bg-secondary/40 px-3 text-base"
        >
          <option value="">Tous les packs</option>
          {PACKS.map((entry) => (
            <option key={entry.slug} value={entry.slug}>
              {entry.name}
            </option>
          ))}
        </select>
      </div>

      {items === null ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState title="Aucune entrée" message="Ajustez les filtres ou ajoutez une entrée." />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{total} entrée(s)</p>
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  'flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2',
                  !item.is_active && 'opacity-60',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {kind === 'impostor' ? item.word : item.civilian_word}
                    {kind === 'pair' && (
                      <span className="text-muted-foreground"> / {item.undercover_word}</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {kind === 'impostor' ? `Indice : ${item.hint} · ` : ''}
                    {item.categories?.name ?? '—'} · {t(`difficulty.${item.difficulty}`)} ·{' '}
                    {item.pack_links.map((link) => link.packs?.name).filter(Boolean).join(', ')}
                  </p>
                </div>
                {!item.is_active && <Badge variant="outline">Désactivé</Badge>}
                <Switch
                  checked={item.is_active}
                  onCheckedChange={() => void toggleActive(item)}
                  aria-label={`Activer ${item.slug}`}
                />
                <Button variant="ghost" size="icon" onClick={() => openEdit(item)} aria-label="Modifier">
                  <Pencil className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void remove(item)}
                  aria-label="Supprimer"
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              Précédent
            </Button>
            <span className="text-xs text-muted-foreground">Page {page + 1}</span>
            <Button
              variant="secondary"
              size="sm"
              disabled={(page + 1) * 25 >= total}
              onClick={() => setPage((value) => value + 1)}
            >
              {t('common.next')}
            </Button>
          </div>
        </>
      )}

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Modifier une entrée' : 'Nouvelle entrée'}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              {kind === 'impostor' ? (
                <>
                  <Field label="Mot secret">
                    <Input
                      value={form.word}
                      onChange={(event) => setForm({ ...form, word: event.target.value })}
                    />
                  </Field>
                  <Field label="Indice imposteur">
                    <Input
                      value={form.hint}
                      onChange={(event) => setForm({ ...form, hint: event.target.value })}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Mot civil">
                    <Input
                      value={form.civilianWord}
                      onChange={(event) => setForm({ ...form, civilianWord: event.target.value })}
                    />
                  </Field>
                  <Field label="Mot undercover">
                    <Input
                      value={form.undercoverWord}
                      onChange={(event) => setForm({ ...form, undercoverWord: event.target.value })}
                    />
                  </Field>
                </>
              )}

              <Field label="Catégorie">
                <Input
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  placeholder="Animaux, Nourriture…"
                />
              </Field>

              <Field label="Réponses acceptées (Mr. White), séparées par des virgules">
                <Input
                  value={form.acceptedAnswers}
                  onChange={(event) => setForm({ ...form, acceptedAnswers: event.target.value })}
                  placeholder="telephone, smartphone, portable"
                />
              </Field>

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-muted-foreground">
                  {t('create.difficulty')}
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {DIFFICULTIES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm({ ...form, difficulty: value })}
                      aria-pressed={form.difficulty === value}
                      className={cn(
                        'min-h-11 rounded-lg border-2 border-border bg-card text-xs font-semibold',
                        form.difficulty === value && 'border-primary bg-primary/10',
                      )}
                    >
                      {t(`difficulty.${value}`)}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-muted-foreground">
                  {t('create.packs')}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {PACKS.map((entry) => (
                    <button
                      key={entry.slug}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          packs: form.packs.includes(entry.slug)
                            ? form.packs.filter((slug) => slug !== entry.slug)
                            : [...form.packs, entry.slug],
                        })
                      }
                      aria-pressed={form.packs.includes(entry.slug)}
                      className={cn(
                        'min-h-11 rounded-full border-2 border-border px-3 text-xs font-semibold',
                        form.packs.includes(entry.slug) && 'border-primary bg-primary/10 text-primary',
                      )}
                    >
                      {entry.name}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="flex items-center justify-between">
                <Label htmlFor="word-active">Actif</Label>
                <Switch
                  id="word-active"
                  checked={form.isActive}
                  onCheckedChange={(isActive) => setForm({ ...form, isActive })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setForm(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save} loading={saving}>
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
