'use client'

import * as React from 'react'
import { FilterX, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { EmptyState, LoadingState } from '@/flexgames/ui/states'
import { api, describeError } from '@/flexgames/core/api/client'
import { DIFFICULTIES, type Difficulty } from '@/games/the-imposter/engine/types'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

type Kind = 'impostor' | 'pair'
type StatusFilter = 'all' | 'active' | 'inactive'
type Sort = 'alpha' | 'updated'

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
  updated_at: string
  categories: { id: string; slug: string; name: string } | null
  pack_links: { packs: { slug: string; name: string } | null }[]
}

interface CatalogMetadata {
  categories: { id: string; slug: string; name: string }[]
  packs: { id: string; slug: string; name: string; description: string; emoji: string; is_active: boolean }[]
  counts: Record<Kind, { total: number; active: number }>
}

interface FormState {
  kind: Kind
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

const PAGE_SIZES = [25, 50, 100] as const
const SELECT_CLASS = 'h-12 rounded-lg border border-input bg-secondary/40 px-3 text-sm'

function emptyForm(kind: Kind): FormState {
  return {
    kind,
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
}

/** Gestion complète du catalogue lexical utilisé par les parties en ligne. */
export function AdminWords() {
  const [kind, setKind] = React.useState<Kind>('pair')
  const [metadata, setMetadata] = React.useState<CatalogMetadata | null>(null)
  const [items, setItems] = React.useState<WordItem[] | null>(null)
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(0)
  const [pageSize, setPageSize] = React.useState<(typeof PAGE_SIZES)[number]>(50)
  const [searchInput, setSearchInput] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState<StatusFilter>('all')
  const [difficulty, setDifficulty] = React.useState<Difficulty | ''>('')
  const [category, setCategory] = React.useState('')
  const [pack, setPack] = React.useState('')
  const [sort, setSort] = React.useState<Sort>('alpha')
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set())
  const [form, setForm] = React.useState<FormState | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [mutating, setMutating] = React.useState(false)
  const requestId = React.useRef(0)

  const loadMetadata = React.useCallback(async () => {
    try {
      const result = await api.get<CatalogMetadata>('/api/admin/words?metadata=true')
      setMetadata(result)
    } catch (error) {
      toast.error(describeError(error, 'Impossible de charger les catégories et les packs.'))
    }
  }, [])

  const load = React.useCallback(async () => {
    const currentRequest = ++requestId.current
    const params = new URLSearchParams({
      kind,
      page: String(page),
      pageSize: String(pageSize),
      status,
      sort,
    })
    if (search) params.set('search', search)
    if (difficulty) params.set('difficulty', difficulty)
    if (category) params.set('category', category)
    if (pack) params.set('pack', pack)
    try {
      const result = await api.get<{ items: WordItem[]; total: number }>(`/api/admin/words?${params}`)
      if (currentRequest !== requestId.current) return
      setItems(result.items)
      setTotal(result.total)
      setSelected(new Set())
    } catch (error) {
      if (currentRequest !== requestId.current) return
      toast.error(describeError(error, 'Chargement impossible.'))
      setItems([])
      setTotal(0)
    }
  }, [kind, page, pageSize, status, sort, search, difficulty, category, pack])

  React.useEffect(() => {
    const timer = window.setTimeout(() => void loadMetadata(), 0)
    return () => window.clearTimeout(timer)
  }, [loadMetadata])

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const refresh = async () => {
    await Promise.all([load(), loadMetadata()])
  }

  const changeKind = (value: Kind) => {
    setKind(value)
    setPage(0)
    setSelected(new Set())
  }

  const resetFilters = () => {
    setSearchInput('')
    setSearch('')
    setStatus('all')
    setDifficulty('')
    setCategory('')
    setPack('')
    setSort('alpha')
    setPage(0)
  }

  const save = async () => {
    if (!form || !isFormValid(form)) return
    setSaving(true)
    const acceptedAnswers = Array.from(new Set(
      form.acceptedAnswers.split(/[,\n]/).map((entry) => entry.trim()).filter(Boolean),
    ))
    const common = {
      category: form.category.trim(),
      difficulty: form.difficulty,
      packs: form.packs,
      acceptedAnswers,
      isActive: form.isActive,
    }
    const data = form.kind === 'impostor'
      ? { ...common, word: form.word.trim(), hint: form.hint.trim() }
      : {
          ...common,
          civilianWord: form.civilianWord.trim(),
          undercoverWord: form.undercoverWord.trim(),
        }

    try {
      if (form.id) await api.patch('/api/admin/words', { kind: form.kind, id: form.id, data })
      else await api.post('/api/admin/words', { kind: form.kind, data })
      toast.success(form.id ? 'Entrée mise à jour.' : 'Entrée ajoutée.')
      setForm(null)
      await refresh()
    } catch (error) {
      toast.error(describeError(error, 'Enregistrement impossible.'))
    } finally {
      setSaving(false)
    }
  }

  const setActive = async (ids: string[], isActive: boolean) => {
    setMutating(true)
    try {
      if (ids.length === 1) {
        await api.patch('/api/admin/words', { kind, id: ids[0], data: { isActive } })
      } else {
        await api.patch('/api/admin/words', { kind, ids, data: { isActive } })
      }
      toast.success(`${ids.length} entrée${ids.length > 1 ? 's' : ''} ${isActive ? 'activée' : 'désactivée'}${ids.length > 1 ? 's' : ''}.`)
      await refresh()
    } catch (error) {
      toast.error(describeError(error, 'Modification impossible.'))
    } finally {
      setMutating(false)
    }
  }

  const remove = async (ids: string[]) => {
    if (!window.confirm(`Supprimer définitivement ${ids.length > 1 ? `ces ${ids.length} entrées` : 'cette entrée'} ?`)) return
    setMutating(true)
    try {
      await api.delete('/api/admin/words', ids.length === 1 ? { kind, id: ids[0] } : { kind, ids })
      toast.success(`${ids.length} entrée${ids.length > 1 ? 's supprimées' : ' supprimée'}.`)
      await loadMetadata()
      if (items && ids.length >= items.length && page > 0) setPage((value) => value - 1)
      else await load()
    } catch (error) {
      toast.error(describeError(error, 'Suppression impossible.'))
    } finally {
      setMutating(false)
    }
  }

  const openEdit = (item: WordItem) => setForm({
    kind,
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

  const toggleSelection = (id: string) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const allPageSelected = Boolean(items?.length) && items!.every((item) => selected.has(item.id))
  const hasFilters = Boolean(search || difficulty || category || pack || status !== 'all' || sort !== 'alpha')
  const counts = metadata?.counts[kind]
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Catalogue de mots</h2>
          <p className="text-sm text-muted-foreground">
            Ajoutez, corrigez, classez ou désactivez les mots réellement utilisés en ligne.
          </p>
        </div>
        <Button size="sm" onClick={() => setForm(emptyForm(kind))}>
          <Plus className="h-4 w-4" aria-hidden /> Ajouter une entrée
        </Button>
      </header>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Total" value={counts?.total} />
        <Stat label="Actifs dans le jeu" value={counts?.active} tone="success" />
        <Stat label="Désactivés" value={counts ? counts.total - counts.active : undefined} tone="muted" />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Type d’entrée">
        {(['pair', 'impostor'] as const).map((value) => (
          <Button
            key={value}
            variant={kind === value ? 'default' : 'secondary'}
            size="sm"
            onClick={() => changeKind(value)}
            aria-pressed={kind === value}
          >
            {value === 'pair' ? 'Paires Undercover' : 'Mots Imposteur'}
            {metadata && <Badge variant="outline">{metadata.counts[value].total}</Badge>}
          </Button>
        ))}
      </div>

      <Card className="p-4">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault()
            setSearch(searchInput.trim())
            setPage(0)
          }}
        >
          <div className="flex gap-2 sm:col-span-2">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Mot, paire ou indice…"
              aria-label="Rechercher dans tous les mots"
            />
            <Button type="submit" size="icon" aria-label="Rechercher"><Search className="h-4 w-4" /></Button>
          </div>
          <FilterSelect label="État" value={status} onChange={(value) => { setStatus(value as StatusFilter); setPage(0) }}>
            <option value="all">Tous les états</option>
            <option value="active">Actifs</option>
            <option value="inactive">Désactivés</option>
          </FilterSelect>
          <FilterSelect label="Difficulté" value={difficulty} onChange={(value) => { setDifficulty(value as Difficulty | ''); setPage(0) }}>
            <option value="">Toutes difficultés</option>
            {DIFFICULTIES.map((value) => <option key={value} value={value}>{t(`difficulty.${value}`)}</option>)}
          </FilterSelect>
          <FilterSelect label="Catégorie" value={category} onChange={(value) => { setCategory(value); setPage(0) }}>
            <option value="">Toutes catégories</option>
            {metadata?.categories.map((entry) => <option key={entry.id} value={entry.slug}>{entry.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Pack" value={pack} onChange={(value) => { setPack(value); setPage(0) }}>
            <option value="">Tous les packs</option>
            {metadata?.packs.map((entry) => <option key={entry.id} value={entry.slug}>{entry.emoji} {entry.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Tri" value={sort} onChange={(value) => { setSort(value as Sort); setPage(0) }}>
            <option value="alpha">Ordre alphabétique</option>
            <option value="updated">Modifiés récemment</option>
          </FilterSelect>
          <div className="flex items-end">
            <Button type="button" variant="ghost" size="sm" disabled={!hasFilters} onClick={resetFilters}>
              <FilterX className="h-4 w-4" aria-hidden /> Réinitialiser
            </Button>
          </div>
        </form>
      </Card>

      {items === null ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState title="Aucune entrée" message="Ajustez les filtres ou ajoutez une nouvelle entrée." />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 font-medium text-foreground">
              <input
                type="checkbox"
                className="h-5 w-5 accent-primary"
                checked={allPageSelected}
                onChange={() => setSelected(allPageSelected ? new Set() : new Set(items.map((item) => item.id)))}
              />
              Tout sélectionner sur cette page
            </label>
            <span>{total} résultat{total > 1 ? 's' : ''}</span>
          </div>

          {selected.size > 0 && (
            <Card className="sticky top-2 z-20 flex flex-wrap items-center gap-2 bg-paper p-3">
              <strong className="mr-auto text-sm">{selected.size} sélectionnée{selected.size > 1 ? 's' : ''}</strong>
              <Button size="sm" variant="success" disabled={mutating} onClick={() => void setActive([...selected], true)}>Activer</Button>
              <Button size="sm" variant="secondary" disabled={mutating} onClick={() => void setActive([...selected], false)}>Désactiver</Button>
              <Button size="sm" variant="destructive" disabled={mutating} onClick={() => void remove([...selected])}>
                <Trash2 className="h-4 w-4" aria-hidden /> Supprimer
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setSelected(new Set())} aria-label="Annuler la sélection"><X className="h-4 w-4" /></Button>
            </Card>
          )}

          <ul className="space-y-2">
            {items.map((item) => {
              const packs = item.pack_links.map((link) => link.packs).filter((entry): entry is { slug: string; name: string } => Boolean(entry))
              return (
                <li key={item.id} className={cn('flex gap-3 rounded-lg border border-border bg-card p-3', !item.is_active && 'bg-muted/50')}>
                  <label className="flex min-h-11 cursor-pointer items-center" aria-label={`Sélectionner ${item.slug}`}>
                    <input type="checkbox" className="h-5 w-5 accent-primary" checked={selected.has(item.id)} onChange={() => toggleSelection(item.id)} />
                  </label>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words font-semibold">
                        {kind === 'impostor' ? item.word : item.civilian_word}
                        {kind === 'pair' && <span className="text-muted-foreground"> / {item.undercover_word}</span>}
                      </p>
                      <Badge variant={item.is_active ? 'success' : 'outline'}>{item.is_active ? 'Actif' : 'Désactivé'}</Badge>
                    </div>
                    {kind === 'impostor' && <p className="mt-1 text-sm text-muted-foreground">Indice : {item.hint}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{item.categories?.name ?? 'Sans catégorie'}</Badge>
                      <Badge variant="outline">{t(`difficulty.${item.difficulty}`)}</Badge>
                      {packs.map((entry) => <Badge key={entry.slug} variant="outline">{entry.name}</Badge>)}
                      {item.accepted_answers.length > 0 && <Badge variant="outline">{item.accepted_answers.length} réponse{item.accepted_answers.length > 1 ? 's' : ''}</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-1 sm:flex-row">
                    <Switch checked={item.is_active} disabled={mutating} onCheckedChange={(value) => void setActive([item.id], value)} aria-label={`${item.is_active ? 'Désactiver' : 'Activer'} ${item.slug}`} />
                    <Button variant="ghost" size="icon" disabled={mutating} onClick={() => openEdit(item)} aria-label={`Modifier ${item.slug}`}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" disabled={mutating} onClick={() => void remove([item.id])} aria-label={`Supprimer ${item.slug}`} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Précédent</Button>
            <span className="text-sm text-muted-foreground">Page {page + 1} sur {pageCount}</span>
            <div className="flex items-center gap-2">
              <label htmlFor="word-page-size" className="text-xs text-muted-foreground">Par page</label>
              <select id="word-page-size" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as (typeof PAGE_SIZES)[number]); setPage(0) }} className="h-11 rounded-lg border border-input bg-secondary/40 px-2 text-sm">
                {PAGE_SIZES.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <Button variant="secondary" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>{t('common.next')}</Button>
            </div>
          </div>
        </>
      )}

      <WordDialog form={form} metadata={metadata} saving={saving} onChange={setForm} onSave={() => void save()} />
    </div>
  )
}

function WordDialog({ form, metadata, saving, onChange, onSave }: {
  form: FormState | null
  metadata: CatalogMetadata | null
  saving: boolean
  onChange: (form: FormState | null) => void
  onSave: () => void
}) {
  return (
    <Dialog open={form !== null} onOpenChange={(open) => !open && onChange(null)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{form?.id ? 'Modifier' : 'Ajouter'} {form?.kind === 'impostor' ? 'un mot Imposteur' : 'une paire Undercover'}</DialogTitle>
        </DialogHeader>
        {form && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {form.kind === 'impostor' ? (
                <>
                  <Field label="Mot secret" id="catalog-word">
                    <Input id="catalog-word" value={form.word} maxLength={60} autoFocus onChange={(event) => onChange({ ...form, word: event.target.value })} />
                  </Field>
                  <Field label="Indice donné à l’imposteur" id="catalog-hint">
                    <Input id="catalog-hint" value={form.hint} maxLength={60} onChange={(event) => onChange({ ...form, hint: event.target.value })} />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Mot des civils" id="catalog-civilian-word">
                    <Input id="catalog-civilian-word" value={form.civilianWord} maxLength={60} autoFocus onChange={(event) => onChange({ ...form, civilianWord: event.target.value })} />
                  </Field>
                  <Field label="Mot de l’Undercover" id="catalog-undercover-word">
                    <Input id="catalog-undercover-word" value={form.undercoverWord} maxLength={60} onChange={(event) => onChange({ ...form, undercoverWord: event.target.value })} />
                  </Field>
                </>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Catégorie" id="catalog-category">
                <Input id="catalog-category" list="catalog-categories" value={form.category} maxLength={40} placeholder="Animaux, Nourriture…" onChange={(event) => onChange({ ...form, category: event.target.value })} />
                <datalist id="catalog-categories">{metadata?.categories.map((entry) => <option key={entry.id} value={entry.name} />)}</datalist>
              </Field>
              <Field label="Difficulté" id="catalog-difficulty">
                <select id="catalog-difficulty" value={form.difficulty} onChange={(event) => onChange({ ...form, difficulty: event.target.value as Difficulty })} className={cn(SELECT_CLASS, 'w-full')}>
                  {DIFFICULTIES.map((value) => <option key={value} value={value}>{t(`difficulty.${value}`)}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Réponses acceptées pour Mr. White" id="catalog-answers" hint="Une variante par ligne ou séparée par une virgule.">
              <textarea id="catalog-answers" value={form.acceptedAnswers} maxLength={600} rows={3} onChange={(event) => onChange({ ...form, acceptedAnswers: event.target.value })} className="w-full resize-y rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm" placeholder="téléphone, smartphone, portable" />
            </Field>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Packs <span className="text-destructive">*</span></legend>
              <div className="flex flex-wrap gap-2">
                {metadata?.packs.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    disabled={!entry.is_active}
                    onClick={() => onChange({
                      ...form,
                      packs: form.packs.includes(entry.slug) ? form.packs.filter((slug) => slug !== entry.slug) : [...form.packs, entry.slug],
                    })}
                    aria-pressed={form.packs.includes(entry.slug)}
                    className={cn('min-h-11 rounded-full border-2 border-border px-3 text-xs font-semibold disabled:opacity-50', form.packs.includes(entry.slug) && 'border-primary bg-primary/10 text-primary')}
                    title={entry.description}
                  >
                    {entry.emoji} {entry.name}
                  </button>
                ))}
              </div>
              {form.packs.length === 0 && <p className="mt-1 text-xs text-destructive">Sélectionnez au moins un pack.</p>}
            </fieldset>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="catalog-active">Disponible dans les prochaines parties</Label>
                <p className="text-xs text-muted-foreground">Une entrée désactivée reste dans le catalogue mais ne sera plus tirée.</p>
              </div>
              <Switch id="catalog-active" checked={form.isActive} onCheckedChange={(isActive) => onChange({ ...form, isActive })} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onChange(null)}>{t('common.cancel')}</Button>
          <Button disabled={!form || !isFormValid(form)} loading={saving} onClick={onSave}>{form?.id ? 'Enregistrer' : 'Ajouter'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function isFormValid(form: FormState): boolean {
  const wordsValid = form.kind === 'impostor'
    ? form.word.trim().length >= 2 && form.hint.trim().length >= 2 && form.word.trim().toLocaleLowerCase('fr') !== form.hint.trim().toLocaleLowerCase('fr')
    : form.civilianWord.trim().length >= 2 && form.undercoverWord.trim().length >= 2 && form.civilianWord.trim().toLocaleLowerCase('fr') !== form.undercoverWord.trim().toLocaleLowerCase('fr')
  return wordsValid && form.category.trim().length >= 2 && form.packs.length > 0
}

function Stat({ label, value, tone = 'default' }: { label: string; value: number | undefined; tone?: 'default' | 'success' | 'muted' }) {
  return (
    <Card className={cn('p-3 sm:p-4', tone === 'success' && 'bg-green/30', tone === 'muted' && 'bg-muted/60')}>
      <p className="min-h-8 text-[11px] font-medium leading-tight text-muted-foreground sm:min-h-0 sm:text-xs">{label}</p>
      <p className="mt-1 text-xl font-bold sm:text-2xl">{value ?? '—'}</p>
    </Card>
  )
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={SELECT_CLASS}>{children}</select>
    </label>
  )
}

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
