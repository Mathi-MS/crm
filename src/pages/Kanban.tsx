import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Avatar, PageBanner, SourceBadge, SourceFilter, StatusSelect, TestBadge, ago, searchCls, useLeadFilters, useLeads,
} from '../components/leadKit'

/** One column per stage. Drag a card to another column (or use its dropdown) to move the lead. */
export default function Kanban() {
  const { leads, statuses, error, changeStatus } = useLeads()
  const { query, setQuery, source, setSource, sources, filtered } = useLeadFilters(leads)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-6xl">
      <PageBanner title="Kanban board" subtitle="Drag a lead from one stage to the next as it moves toward a sale." />

      {error && <div role="alert" className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}
      {!leads && !error && <p className="text-sm text-muted">Loading…</p>}

      {leads && leads.length === 0 && (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
          <h3 className="text-lg font-bold">No leads yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            New leads will appear in the first column. Connect an account in{' '}
            <Link to="/connections" className="font-medium text-brand-text underline">Connections</Link>.
          </p>
        </div>
      )}

      {leads && leads.length > 0 && (
        <div>
          <div className="z-10 -mx-1 bg-page px-1 py-3 md:sticky md:top-[65px]">
            <div className="flex flex-wrap items-center gap-3">
              <p className="mr-auto text-sm text-muted">
                {filtered.length === leads.length ? `${leads.length} lead${leads.length === 1 ? '' : 's'}` : `${filtered.length} of ${leads.length} leads`}
              </p>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or phone" aria-label="Search leads" className={searchCls} />
              <SourceFilter sources={sources} value={source} onChange={setSource} />
            </div>
          </div>

          <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-4 pt-1">
            {statuses.map((s) => {
              const items = filtered.filter((l) => l.status === s.key)
              const isOver = over === s.key && dragId !== null
              return (
                <section
                  key={s.key}
                  aria-label={`${s.label}, ${items.length} leads`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (over !== s.key) setOver(s.key)
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const id = e.dataTransfer.getData('text/plain') || dragId
                    if (id) changeStatus(id, s.key)
                    setDragId(null)
                    setOver(null)
                  }}
                  className={`flex w-72 shrink-0 flex-col rounded-2xl border bg-soft/60 transition ${isOver ? 'border-brand ring-4 ring-brand/25' : 'border-line'}`}
                >
                  <header className="flex items-center gap-2 rounded-t-2xl border-b border-line bg-surface px-4 py-3" style={{ borderTop: `4px solid ${s.color}` }}>
                    <h3 className="flex-1 text-sm font-bold">{s.label}</h3>
                    <span className="rounded-full bg-soft px-2 py-0.5 text-xs font-bold text-muted">{items.length}</span>
                  </header>

                  <div className="flex max-h-[calc(100dvh-270px)] min-h-24 flex-1 flex-col gap-3 overflow-y-auto p-3">
                    {items.map((l) => (
                      <article
                        key={l.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', l.id)
                          e.dataTransfer.effectAllowed = 'move'
                          setDragId(l.id)
                        }}
                        onDragEnd={() => {
                          setDragId(null)
                          setOver(null)
                        }}
                        className={`cursor-grab rounded-xl border border-line bg-surface p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing ${dragId === l.id ? 'opacity-40' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar lead={l} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-sm font-bold"><span className="truncate">{l.name || '—'}</span>{l.isTest && <TestBadge />}</div>
                            <div className="truncate text-xs text-muted">{l.email || l.phone || '—'}</div>
                          </div>
                        </div>
                        {l.phone && l.email && <div className="mt-2 truncate text-xs text-muted">{l.phone}</div>}
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-xs text-muted" title={new Date(l.receivedAt).toLocaleString()}>
                            <SourceBadge source={l.source} compact />
                            {ago(l.receivedAt)}
                          </span>
                          <StatusSelect lead={l} statuses={statuses} onChange={changeStatus} small />
                        </div>
                      </article>
                    ))}
                    {items.length === 0 && (
                      <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
                        Drop a lead here
                      </div>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
