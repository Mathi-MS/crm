import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { SourceIcon } from './brandIcons'

/* Shared by the Leads page (table / cards) and the Kanban page. */

export type Status = { key: string; label: string; color: string }
export type Lead = {
  id: string
  name: string
  email: string
  phone: string
  source: string
  formId?: string
  status: string
  isTest: boolean
  receivedAt: string
}

const SOURCES: Record<string, { label: string }> = {
  meta: { label: 'Meta Ads' },
  google: { label: 'Google Ads' },
  manual: { label: 'Added manually' },
}
export const sourceOf = (s: string) => SOURCES[s] ?? { label: s }

export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`
  return new Date(iso).toLocaleDateString()
}

/** Loads the leads and the stages, and moves a lead between stages. */
export function useLeads() {
  const [leads, setLeads] = useState<Lead[] | null>(null)
  const [statuses, setStatuses] = useState<Status[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ leads: Lead[]; statuses: Status[] }>('/api/leads')
      .then((d) => {
        setLeads(d.leads)
        setStatuses(d.statuses)
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  /** Show the move at once, undo it if the server says no. */
  const changeStatus = useCallback(
    async (id: string, status: string) => {
      const before = leads?.find((l) => l.id === id)
      if (!before || before.status === status) return
      setError('')
      setLeads((list) => list && list.map((l) => (l.id === id ? { ...l, status } : l)))
      try {
        await api(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      } catch (e) {
        setLeads((list) => list && list.map((l) => (l.id === id ? { ...l, status: before.status } : l)))
        setError((e as Error).message)
      }
    },
    [leads],
  )

  return { leads, statuses, error, changeStatus }
}

export function Avatar({ lead, size = 8 }: { lead: Lead; size?: 8 | 11 }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-brand font-bold text-on-brand ${size === 8 ? 'h-8 w-8 text-xs' : 'h-11 w-11 text-base'}`}>
      {(lead.name || lead.email || '?').charAt(0).toUpperCase()}
    </span>
  )
}

export function SourceBadge({ source, compact }: { source: string; compact?: boolean }) {
  const src = sourceOf(source)
  return (
    <span className="inline-flex items-center gap-2" title={src.label}>
      <SourceIcon source={source} size={24} />
      {!compact && src.label}
    </span>
  )
}

export const TestBadge = () => (
  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Test</span>
)

/** The status dropdown shown on every lead. */
export function StatusSelect({ lead, statuses, onChange, small }: { lead: Lead; statuses: Status[]; onChange: (id: string, status: string) => void; small?: boolean }) {
  const current = statuses.find((s) => s.key === lead.status)
  return (
    <select
      value={lead.status}
      onChange={(e) => onChange(lead.id, e.target.value)}
      aria-label={`Status for ${lead.name || lead.email}`}
      onClick={(e) => e.stopPropagation()}
      className={`cursor-pointer rounded-lg border border-line bg-surface font-bold text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/25 ${small ? 'py-1 pl-2 pr-1 text-[11px]' : 'py-1.5 pl-3 pr-2 text-xs'}`}
      style={{ borderLeft: `4px solid ${current?.color ?? '#8b95a7'}` }}
    >
      {statuses.map((s) => (
        <option key={s.key} value={s.key}>{s.label}</option>
      ))}
    </select>
  )
}

export function PageBanner({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl bg-sidebar p-6 text-white shadow-sm sm:p-8">
      <div className="relative">
        <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-brand/40 blur-3xl" aria-hidden />
        <h2 className="relative text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
        <p className="relative mt-1 max-w-md text-sm text-white/60">{subtitle}</p>
      </div>
    </div>
  )
}

/** Search box + source filter, used by both pages. */
export function useLeadFilters(leads: Lead[] | null) {
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('all')
  const sources = Array.from(new Set((leads ?? []).map((l) => l.source)))
  const q = query.trim().toLowerCase()
  const filtered = (leads ?? []).filter(
    (l) => (source === 'all' || l.source === source) && (!q || [l.name, l.email, l.phone].some((v) => v?.toLowerCase().includes(q))),
  )
  return { query, setQuery, source, setSource, sources, filtered }
}

export const searchCls =
  'w-full rounded-[10px] border border-ink/20 bg-surface px-3 py-2 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/25 sm:w-64'

export function SourceFilter({ sources, value, onChange }: { sources: string[]; value: string; onChange: (s: string) => void }) {
  if (sources.length < 2) return null
  return (
    <div className="inline-flex rounded-xl border border-line bg-surface p-1">
      {['all', ...sources].map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          aria-pressed={value === s}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${value === s ? 'bg-brand text-on-brand shadow-sm' : 'text-muted hover:text-ink'}`}
        >
          {s !== 'all' && <SourceIcon source={s} size={18} />}
          {s === 'all' ? 'All' : sourceOf(s).label}
        </button>
      ))}
    </div>
  )
}
