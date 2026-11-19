import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Drawer from '../components/Drawer'
import { fieldCls } from '../components/Modal'
import {
  Avatar, PageBanner, SourceBadge, SourceFilter, StatusSelect, TestBadge, ago, useLeadFilters, useLeads,
  type Lead, type Status,
} from '../components/leadKit'

type ViewProps = { leads: Lead[]; statuses: Status[]; onStatus: (id: string, status: string) => void }

function TableView({ leads, statuses, onStatus }: ViewProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-soft text-xs uppercase tracking-widest text-muted">
            <tr>
              {['Name', 'Contact', 'Source', 'Status', 'Received'].map((h) => (
                <th key={h} className="px-4 py-3 font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar lead={l} />
                    <span className="font-medium">{l.name || '—'}</span>
                    {l.isTest && <TestBadge />}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>{l.email || '—'}</div>
                  <div className="text-xs text-muted">{l.phone || ''}</div>
                </td>
                <td className="px-4 py-3"><SourceBadge source={l.source} /></td>
                <td className="px-4 py-3"><StatusSelect lead={l} statuses={statuses} onChange={onStatus} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-muted" title={new Date(l.receivedAt).toLocaleString()}>{ago(l.receivedAt)}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">No leads match your filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const Mail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
)
const Phone = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted" aria-hidden><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>
)

function CardView({ leads, statuses, onStatus }: ViewProps) {
  if (leads.length === 0) {
    return <div className="rounded-2xl border border-line bg-surface px-4 py-10 text-center text-sm text-muted shadow-sm">No leads match your filters.</div>
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {leads.map((l) => {
        const color = statuses.find((s) => s.key === l.status)?.color ?? '#8b95a7'
        return (
          <article key={l.id} className="flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderTop: `3px solid ${color}` }}>
            <div className="flex items-center gap-3">
              <Avatar lead={l} size={11} />
              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-2 font-bold"><span className="truncate">{l.name || '—'}</span>{l.isTest && <TestBadge />}</h3>
                <div className="text-xs text-muted" title={new Date(l.receivedAt).toLocaleString()}>{ago(l.receivedAt)}</div>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2"><Mail /><dt className="sr-only">Email</dt><dd className="min-w-0 truncate">{l.email || '—'}</dd></div>
              <div className="flex items-center gap-2"><Phone /><dt className="sr-only">Phone</dt><dd className="min-w-0 truncate">{l.phone || '—'}</dd></div>
            </dl>
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 text-sm">
              <SourceBadge source={l.source} />
              <StatusSelect lead={l} statuses={statuses} onChange={onStatus} />
            </div>
          </article>
        )
      })}
    </div>
  )
}

type View = 'table' | 'cards'
const VIEWS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'table', label: 'Table', icon: <path d="M3 6h18M3 12h18M3 18h18" /> },
  { id: 'cards', label: 'Cards', icon: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></> },
]

export default function Leads() {
  const { leads, statuses, error, changeStatus } = useLeads()
  const { query, setQuery, source, setSource, sources, filtered } = useLeadFilters(leads)
  const [stage, setStage] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const closeFilters = useCallback(() => setFiltersOpen(false), [])
  const [view, setView] = useState<View>(() => {
    try {
      return localStorage.getItem('leads-view') === 'cards' ? 'cards' : 'table' // an old "kanban" choice falls back to table
    } catch {
      return 'table'
    }
  })

  const chooseView = (v: View) => {
    setView(v)
    try {
      localStorage.setItem('leads-view', v)
    } catch {
      /* storage unavailable */
    }
  }

  // search + source narrow the list first; the status dropdown then counts what is left
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    filtered.forEach((l) => (c[l.status] = (c[l.status] ?? 0) + 1))
    return c
  }, [filtered])
  const shown = useMemo(() => (stage === 'all' ? filtered : filtered.filter((l) => l.status === stage)), [filtered, stage])

  const activeFilters = (query.trim() ? 1 : 0) + (stage !== 'all' ? 1 : 0) + (source !== 'all' ? 1 : 0)
  const resetFilters = () => {
    setQuery('')
    setStage('all')
    setSource('all')
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageBanner title="Leads" subtitle="Every lead from your connected accounts, in one place." />

      {error && <div role="alert" className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}
      {!leads && !error && <p className="text-sm text-muted">Loading…</p>}

      {leads && leads.length === 0 && (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
          <h3 className="text-lg font-bold">No leads yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            New leads from your Meta and Google lead forms will show up here the moment they come in. Connect an account in{' '}
            <Link to="/connections" className="font-medium text-brand-text underline">Connections</Link>.
          </p>
        </div>
      )}

      {leads && leads.length > 0 && (
        <div className="space-y-4">
          {/* stays pinned under the top bar while the list scrolls (not on phones, where it would fill the screen) */}
          <div className="z-10 -mx-1 bg-page px-1 py-3 md:sticky md:top-[65px]">
            <div className="flex items-center gap-3">
              <p className="mr-auto text-sm text-muted">
                {shown.length === leads.length ? `${leads.length} lead${leads.length === 1 ? '' : 's'}` : `${shown.length} of ${leads.length} leads`}
              </p>
              <button
                onClick={() => setFiltersOpen(true)}
                aria-haspopup="dialog"
                aria-label={activeFilters ? `Filters, ${activeFilters} active` : 'Filters'}
                title="Filters"
                className={`relative inline-flex items-center gap-2 rounded-xl border bg-surface px-3 py-2 text-sm font-medium transition hover:bg-ink/5 ${activeFilters ? 'border-brand' : 'border-line'}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" />
                </svg>
                <span className="hidden sm:inline">Filters</span>
                {activeFilters > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-on-brand">{activeFilters}</span>}
              </button>
            </div>
          </div>

          {view === 'table' ? (
            <TableView leads={shown} statuses={statuses} onStatus={changeStatus} />
          ) : (
            <CardView leads={shown} statuses={statuses} onStatus={changeStatus} />
          )}

          {filtersOpen && (
            <Drawer
              title="Filters"
              onClose={closeFilters}
              footer={
                <>
                  <button onClick={resetFilters} disabled={activeFilters === 0} className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium hover:bg-ink/5 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent">
                    Reset
                  </button>
                  <button onClick={closeFilters} className="flex-1 rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-page hover:opacity-90">
                    Show {shown.length} lead{shown.length === 1 ? '' : 's'}
                  </button>
                </>
              }
            >
              <div>
                <label htmlFor="f-search" className="mb-1.5 block text-sm font-bold">Search</label>
                <input id="f-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, email or phone" className={fieldCls} autoFocus />
              </div>

              <div>
                <label htmlFor="f-status" className="mb-1.5 block text-sm font-bold">Status</label>
                <select
                  id="f-status"
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className={`${fieldCls} cursor-pointer`}
                  style={stage === 'all' ? undefined : { borderLeft: `4px solid ${statuses.find((s) => s.key === stage)?.color ?? 'transparent'}` }}
                >
                  <option value="all">All statuses ({filtered.length})</option>
                  {statuses.map((s) => (
                    <option key={s.key} value={s.key}>{s.label} ({counts[s.key] ?? 0})</option>
                  ))}
                </select>
              </div>

              {sources.length > 1 && (
                <div>
                  <div className="mb-1.5 text-sm font-bold">Source</div>
                  <SourceFilter sources={sources} value={source} onChange={setSource} />
                </div>
              )}

              <div>
                <div className="mb-1.5 text-sm font-bold">View</div>
                <div role="group" aria-label="View" className="inline-flex rounded-xl border border-line bg-surface p-1">
                  {VIEWS.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => chooseView(v.id)}
                      aria-pressed={view === v.id}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${view === v.id ? 'bg-brand text-on-brand shadow-sm' : 'text-muted hover:text-ink'}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{v.icon}</svg>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </Drawer>
          )}
        </div>
      )}
    </div>
  )
}
