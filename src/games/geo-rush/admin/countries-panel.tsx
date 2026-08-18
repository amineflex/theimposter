'use client'

import * as React from 'react'
import { FilterX, Pencil, Search, Undo2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { api, describeError } from '@/flexgames/core/api/client'
import { EmptyState, LoadingState } from '@/flexgames/ui/states'
import type { GeoDifficulty, GeoRegion } from '../types'
import { cn } from '@/lib/utils'

type Region = Exclude<GeoRegion, 'world'>
type StatusFilter = 'all' | 'active' | 'inactive' | 'customized'
type Sort = 'alpha' | 'updated'

interface CountryItem {
  code: string
  numericId: string
  name: string
  capital: string
  region: Region
  difficulty: GeoDifficulty
  aliases: string[]
  capitalAliases: string[]
  isActive: boolean
  customized: boolean
  updatedAt: string | null
}

interface FormState extends CountryItem {
  aliasesInput: string
  capitalAliasesInput: string
}

interface Counts {
  total: number
  active: number
  customized: number
}

const PAGE_SIZES = [25, 50, 100] as const
const SELECT_CLASS = 'h-12 rounded-lg border border-input bg-secondary/40 px-3 text-sm text-foreground'
const REGIONS: Region[] = ['europe', 'africa', 'asia', 'americas', 'oceania']
const DIFFICULTIES: GeoDifficulty[] = ['easy', 'normal', 'hard']
const REGION_LABELS: Record<Region, string> = {
  europe: 'Europe',
  africa: 'Afrique',
  asia: 'Asie',
  americas: 'Amériques',
  oceania: 'Océanie',
}
const DIFFICULTY_LABELS: Record<GeoDifficulty, string> = {
  easy: 'Facile',
  normal: 'Normal',
  hard: 'Difficile',
}

/** Administration des réponses et de la disponibilité du catalogue GeoRush. */
export function AdminCountries() {
  const [items, setItems] = React.useState<CountryItem[] | null>(null)
  const [counts, setCounts] = React.useState<Counts | null>(null)
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(0)
  const [pageSize, setPageSize] = React.useState<(typeof PAGE_SIZES)[number]>(50)
  const [searchInput, setSearchInput] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [region, setRegion] = React.useState<Region | ''>('')
  const [difficulty, setDifficulty] = React.useState<GeoDifficulty | ''>('')
  const [status, setStatus] = React.useState<StatusFilter>('all')
  const [sort, setSort] = React.useState<Sort>('alpha')
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set())
  const [form, setForm] = React.useState<FormState | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [mutating, setMutating] = React.useState(false)
  const requestId = React.useRef(0)

  const load = React.useCallback(async () => {
    const currentRequest = ++requestId.current
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      status,
      sort,
    })
    if (search) params.set('search', search)
    if (region) params.set('region', region)
    if (difficulty) params.set('difficulty', difficulty)
    try {
      const result = await api.get<{ items: CountryItem[]; total: number; counts: Counts }>(`/api/admin/geo-rush?${params}`)
      if (currentRequest !== requestId.current) return
      setItems(result.items)
      setTotal(result.total)
      setCounts(result.counts)
      setSelected(new Set())
    } catch (error) {
      if (currentRequest !== requestId.current) return
      toast.error(describeError(error, 'Impossible de charger les pays GeoRush.'))
      setItems([])
      setTotal(0)
    }
  }, [page, pageSize, search, region, difficulty, status, sort])

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const resetFilters = () => {
    setSearchInput('')
    setSearch('')
    setRegion('')
    setDifficulty('')
    setStatus('all')
    setSort('alpha')
    setPage(0)
  }

  const save = async () => {
    if (!form || !form.name.trim() || !form.capital.trim()) return
    setSaving(true)
    try {
      await api.patch('/api/admin/geo-rush', {
        code: form.code,
        data: {
          name: form.name.trim(),
          capital: form.capital.trim(),
          difficulty: form.difficulty,
          aliases: parseAnswers(form.aliasesInput),
          capitalAliases: parseAnswers(form.capitalAliasesInput),
          isActive: form.isActive,
        },
      })
      toast.success(`${form.name.trim()} a été mis à jour.`)
      setForm(null)
      await load()
    } catch (error) {
      toast.error(describeError(error, 'Enregistrement impossible.'))
    } finally {
      setSaving(false)
    }
  }

  const setActive = async (codes: string[], isActive: boolean) => {
    setMutating(true)
    try {
      await api.patch('/api/admin/geo-rush', { codes, data: { isActive } })
      toast.success(`${codes.length} pays ${isActive ? 'activé' : 'désactivé'}${codes.length > 1 ? 's' : ''}.`)
      await load()
    } catch (error) {
      toast.error(describeError(error, 'Modification impossible.'))
    } finally {
      setMutating(false)
    }
  }

  const restore = async (codes: string[]) => {
    if (!window.confirm(`Restaurer les valeurs d’origine pour ${codes.length > 1 ? `ces ${codes.length} pays` : 'ce pays'} ?`)) return
    setMutating(true)
    try {
      await api.delete('/api/admin/geo-rush', codes.length === 1 ? { code: codes[0] } : { codes })
      toast.success(`${codes.length} pays restauré${codes.length > 1 ? 's' : ''}.`)
      await load()
    } catch (error) {
      toast.error(describeError(error, 'Restauration impossible.'))
    } finally {
      setMutating(false)
    }
  }

  const openEdit = (item: CountryItem) => setForm({
    ...item,
    aliasesInput: item.aliases.join(', '),
    capitalAliasesInput: item.capitalAliases.join(', '),
  })
  const toggleSelection = (code: string) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    return next
  })
  const allPageSelected = Boolean(items?.length) && items!.every((item) => selected.has(item.code))
  const hasFilters = Boolean(search || region || difficulty || status !== 'all' || sort !== 'alpha')
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-bold">Catalogue GeoRush</h2>
        <p className="text-sm text-muted-foreground">
          Gérez les pays, capitales et réponses acceptées utilisées dans les prochaines parties.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Pays" value={counts?.total} />
        <Stat label="Actifs dans le jeu" value={counts?.active} tone="success" />
        <Stat label="Personnalisés" value={counts?.customized} tone="muted" />
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
            <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Pays, capitale, variante ou code…" aria-label="Rechercher un pays GeoRush" />
            <Button type="submit" size="icon" aria-label="Rechercher"><Search className="h-4 w-4" /></Button>
          </div>
          <FilterSelect label="Région" value={region} onChange={(value) => { setRegion(value as Region | ''); setPage(0) }}>
            <option value="">Toutes les régions</option>
            {REGIONS.map((value) => <option key={value} value={value}>{REGION_LABELS[value]}</option>)}
          </FilterSelect>
          <FilterSelect label="Difficulté" value={difficulty} onChange={(value) => { setDifficulty(value as GeoDifficulty | ''); setPage(0) }}>
            <option value="">Toutes difficultés</option>
            {DIFFICULTIES.map((value) => <option key={value} value={value}>{DIFFICULTY_LABELS[value]}</option>)}
          </FilterSelect>
          <FilterSelect label="État" value={status} onChange={(value) => { setStatus(value as StatusFilter); setPage(0) }}>
            <option value="all">Tous les états</option>
            <option value="active">Actifs</option>
            <option value="inactive">Désactivés</option>
            <option value="customized">Personnalisés</option>
          </FilterSelect>
          <FilterSelect label="Tri" value={sort} onChange={(value) => { setSort(value as Sort); setPage(0) }}>
            <option value="alpha">Ordre alphabétique</option>
            <option value="updated">Modifiés récemment</option>
          </FilterSelect>
          <div className="flex items-end sm:col-span-2">
            <Button type="button" variant="ghost" size="sm" disabled={!hasFilters} onClick={resetFilters}>
              <FilterX className="h-4 w-4" aria-hidden /> Réinitialiser
            </Button>
          </div>
        </form>
      </Card>

      <p className="text-xs text-muted-foreground">
        Les codes ISO et les formes cartographiques sont verrouillés pour garantir l’affichage correct des drapeaux et des cartes.
      </p>

      {items === null ? <LoadingState /> : items.length === 0 ? (
        <EmptyState title="Aucun pays" message="Ajustez les filtres pour retrouver un pays." />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 font-medium text-foreground">
              <input type="checkbox" className="h-5 w-5 accent-primary" checked={allPageSelected} onChange={() => setSelected(allPageSelected ? new Set() : new Set(items.map((item) => item.code)))} />
              Tout sélectionner sur cette page
            </label>
            <span>{total} résultat{total > 1 ? 's' : ''}</span>
          </div>

          {selected.size > 0 && (
            <Card className="sticky top-2 z-20 flex flex-wrap items-center gap-2 bg-paper p-3">
              <strong className="mr-auto text-sm">{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</strong>
              <Button size="sm" variant="success" disabled={mutating} onClick={() => void setActive([...selected], true)}>Activer</Button>
              <Button size="sm" variant="secondary" disabled={mutating} onClick={() => void setActive([...selected], false)}>Désactiver</Button>
              <Button size="sm" variant="secondary" disabled={mutating} onClick={() => void restore([...selected])}><Undo2 className="h-4 w-4" /> Restaurer</Button>
              <Button size="icon" variant="ghost" onClick={() => setSelected(new Set())} aria-label="Annuler la sélection"><X className="h-4 w-4" /></Button>
            </Card>
          )}

          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.code} className={cn('flex gap-3 rounded-lg border border-border bg-card p-3', !item.isActive && 'bg-muted/50')}>
                <label className="flex min-h-11 cursor-pointer items-center" aria-label={`Sélectionner ${item.name}`}>
                  <input type="checkbox" className="h-5 w-5 accent-primary" checked={selected.has(item.code)} onChange={() => toggleSelection(item.code)} />
                </label>
                <span className={`fi fi-${item.code} mt-1 shrink-0 rounded border border-border text-3xl`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{item.name} <span className="font-normal text-muted-foreground">· {item.capital}</span></p>
                    <Badge variant={item.isActive ? 'success' : 'outline'}>{item.isActive ? 'Actif' : 'Désactivé'}</Badge>
                    {item.customized && <Badge variant="secondary">Personnalisé</Badge>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="outline">{item.code.toUpperCase()}</Badge>
                    <Badge variant="secondary">{REGION_LABELS[item.region]}</Badge>
                    <Badge variant="outline">{DIFFICULTY_LABELS[item.difficulty]}</Badge>
                    <Badge variant="outline">{item.aliases.length + item.capitalAliases.length} réponses</Badge>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-center gap-1 sm:flex-row">
                  <Switch checked={item.isActive} disabled={mutating} onCheckedChange={(value) => void setActive([item.code], value)} aria-label={`${item.isActive ? 'Désactiver' : 'Activer'} ${item.name}`} />
                  <Button variant="ghost" size="icon" disabled={mutating} onClick={() => openEdit(item)} aria-label={`Modifier ${item.name}`}><Pencil className="h-4 w-4" /></Button>
                  {item.customized && <Button variant="ghost" size="icon" disabled={mutating} onClick={() => void restore([item.code])} aria-label={`Restaurer ${item.name}`}><Undo2 className="h-4 w-4" /></Button>}
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Précédent</Button>
            <span className="text-sm text-muted-foreground">Page {page + 1} sur {pageCount}</span>
            <div className="flex items-center gap-2">
              <label htmlFor="geo-page-size" className="text-xs text-muted-foreground">Par page</label>
              <select id="geo-page-size" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as (typeof PAGE_SIZES)[number]); setPage(0) }} className="h-11 rounded-lg border border-input bg-secondary/40 px-2 text-sm text-foreground">
                {PAGE_SIZES.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <Button variant="secondary" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>Suivant</Button>
            </div>
          </div>
        </>
      )}

      <CountryDialog form={form} saving={saving} onChange={setForm} onSave={() => void save()} />
    </div>
  )
}

function CountryDialog({ form, saving, onChange, onSave }: {
  form: FormState | null
  saving: boolean
  onChange: (form: FormState | null) => void
  onSave: () => void
}) {
  return (
    <Dialog open={form !== null} onOpenChange={(open) => !open && onChange(null)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Modifier {form?.name}</DialogTitle></DialogHeader>
        {form && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nom du pays" id="geo-country-name">
                <Input id="geo-country-name" value={form.name} maxLength={80} autoFocus onChange={(event) => onChange({ ...form, name: event.target.value })} />
              </Field>
              <Field label="Capitale" id="geo-country-capital">
                <Input id="geo-country-capital" value={form.capital} maxLength={80} onChange={(event) => onChange({ ...form, capital: event.target.value })} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Difficulté" id="geo-country-difficulty">
                <select id="geo-country-difficulty" value={form.difficulty} onChange={(event) => onChange({ ...form, difficulty: event.target.value as GeoDifficulty })} className={cn(SELECT_CLASS, 'w-full')}>
                  {DIFFICULTIES.map((value) => <option key={value} value={value}>{DIFFICULTY_LABELS[value]}</option>)}
                </select>
              </Field>
              <Field label="Identité cartographique" id="geo-country-code" hint="Verrouillée pour conserver le bon drapeau et la bonne forme.">
                <Input id="geo-country-code" value={`${form.code.toUpperCase()} · ${REGION_LABELS[form.region]}`} disabled />
              </Field>
            </div>
            <Field label="Réponses acceptées pour le pays" id="geo-country-aliases" hint="Une variante par ligne ou séparée par une virgule.">
              <textarea id="geo-country-aliases" value={form.aliasesInput} maxLength={1200} rows={3} onChange={(event) => onChange({ ...form, aliasesInput: event.target.value })} className="w-full resize-y rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm text-foreground" />
            </Field>
            <Field label="Réponses acceptées pour la capitale" id="geo-capital-aliases" hint="Ajoutez par exemple les graphies sans accent ou dans une autre langue.">
              <textarea id="geo-capital-aliases" value={form.capitalAliasesInput} maxLength={1200} rows={3} onChange={(event) => onChange({ ...form, capitalAliasesInput: event.target.value })} className="w-full resize-y rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm text-foreground" />
            </Field>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="geo-country-active">Disponible dans les prochaines parties</Label>
                <p className="text-xs text-muted-foreground">Un pays désactivé ne sera plus tiré au sort.</p>
              </div>
              <Switch id="geo-country-active" checked={form.isActive} onCheckedChange={(isActive) => onChange({ ...form, isActive })} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onChange(null)}>Annuler</Button>
          <Button disabled={!form?.name.trim() || !form.capital.trim()} loading={saving} onClick={onSave}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function parseAnswers(value: string): string[] {
  return Array.from(new Set(value.split(/[,\n]/).map((entry) => entry.trim()).filter(Boolean)))
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
