import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { SourceIcon } from '../components/brandIcons'
import { PageBanner, sourceOf, type Status } from '../components/leadKit'

type Dash = {
  filters: { days: number; source: string }
  statuses: Status[]
  total: number
  previousTotal: number | null
  byStatus: Record<string, number>
  bySource: Record<string, number>
  daily: { date: string; count: number }[]
}

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All time' },
]
const SOURCE_OPTIONS = [
  { key: 'all', label: 'All sources' },
  { key: 'meta', label: 'Meta Ads' },
  { key: 'google', label: 'Google Ads' },
  { key: 'manual', label: 'Added manually' },
]
const SOURCE_COLOR: Record<string, string> = { meta: '#1877F2', google: '#EA4335', manual: '#8b95a7' }

const n = (v: number) => v.toLocaleString()
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)
const fmtDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const periodText = (days: number) => (days ? `last ${days} days` : 'all time')

/* ---------- charts (plain SVG / CSS, no chart library) ---------- */

/** width of an element, kept up to date, so the SVG text stays readable on a phone */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(640)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth || 640)
    const ro = new ResizeObserver(() => setW(el.clientWidth || 640))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

type Bucket = { label: string; title: string; count: number }

/** Days for 7 and 30, weeks for 90, months for all time. */
function toBuckets(daily: Dash['daily'], days: number): Bucket[] {
  if (daily.length === 0) return []
  if (days === 7 || days === 30) return daily.map((d) => ({ label: fmtDay(d.date), title: fmtDay(d.date), count: d.count }))
  if (days === 90) {
    const out: Bucket[] = []
    for (let end = daily.length; end > 0; end -= 7) {
      const slice = daily.slice(Math.max(0, end - 7), end)
      const from = fmtDay(slice[0].date)
      const to = fmtDay(slice[slice.length - 1].date)
      out.unshift({ label: from, title: `${from} to ${to}`, count: slice.reduce((s, d) => s + d.count, 0) })
    }
    return out
  }
  // all time: one bar per month, no gaps
  const byMonth = new Map<string, number>()
  daily.forEach((d) => byMonth.set(d.date.slice(0, 7), (byMonth.get(d.date.slice(0, 7)) ?? 0) + d.count))
  const [fy, fm] = daily[0].date.slice(0, 7).split('-').map(Number)
  const [ly, lm] = daily[daily.length - 1].date.slice(0, 7).split('-').map(Number)
  const out: Bucket[] = []
  for (let y = fy, m = fm; y < ly || (y === ly && m <= lm); m === 12 ? ((m = 1), y++) : m++) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    const name = new Date(`${key}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    out.push({ label: name, title: name, count: byMonth.get(key) ?? 0 })
  }
  return out
}

const niceMax = (v: number) => {
  if (v <= 4) return 4
  const p = 10 ** Math.floor(Math.log10(v))
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((c) => c >= v) ?? v
}

function BarChart({ buckets, unit }: { buckets: Bucket[]; unit: string }) {
  const [ref, width] = useWidth()
  const H = 230
  const pad = { l: 34, r: 8, t: 18, b: 30 }
  const plotW = Math.max(60, width - pad.l - pad.r)
  const plotH = H - pad.t - pad.b
  const max = niceMax(Math.max(...buckets.map((b) => b.count), 1))
  const slot = plotW / buckets.length
  const barW = Math.min(36, slot * 0.68)
  const every = Math.ceil(buckets.length / Math.max(2, Math.floor(plotW / 62))) // keep the date labels from touching
  const showValues = slot >= 26

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={H} role="img" aria-label={`Bar chart: ${unit} per bar, highest bar ${Math.max(...buckets.map((b) => b.count))}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = pad.t + plotH * (1 - f)
          return (
            <g key={f}>
              <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} className="stroke-line" strokeWidth={1} />
              <text x={pad.l - 8} y={y + 4} textAnchor="end" className="fill-muted" fontSize={11}>{Math.round(max * f)}</text>
            </g>
          )
        })}
        {buckets.map((b, i) => {
          const h = (b.count / max) * plotH
          const x = pad.l + slot * i + (slot - barW) / 2
          return (
            <g key={i}>
              <rect x={pad.l + slot * i} y={pad.t} width={slot} height={plotH} fill="transparent" />
              <rect x={x} y={pad.t + plotH - h} width={barW} height={Math.max(h, b.count ? 2 : 0)} rx={4} className="fill-brand transition-opacity hover:opacity-70">
                <title>{`${b.title}: ${b.count} ${b.count === 1 ? 'lead' : 'leads'}`}</title>
              </rect>
              {showValues && b.count > 0 && (
                <text x={x + barW / 2} y={pad.t + plotH - h - 5} textAnchor="middle" className="fill-ink" fontSize={11} fontWeight={700}>{b.count}</text>
              )}
              {i % every === 0 && (
                <text x={x + barW / 2} y={H - 9} textAnchor="middle" className="fill-muted" fontSize={11}>{b.label}</text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function Donut({ parts, total }: { parts: { key: string; value: number; color: string }[]; total: number }) {
  const r = 58
  const C = 2 * Math.PI * r
  let acc = 0
  return (
    <svg width={170} height={170} viewBox="0 0 170 170" role="img" aria-label={`Donut chart of ${total} leads by source`} className="shrink-0">
      <g transform="rotate(-90 85 85)">
        <circle cx={85} cy={85} r={r} fill="none" strokeWidth={26} className="stroke-soft" />
        {parts.filter((p) => p.value > 0).map((p) => {
          const len = (p.value / total) * C
          const el = (
            <circle key={p.key} cx={85} cy={85} r={r} fill="none" stroke={p.color} strokeWidth={26} strokeDasharray={`${Math.max(len - 1.5, 0.1)} ${C}`} strokeDashoffset={-acc}>
              <title>{`${sourceOf(p.key).label}: ${p.value}`}</title>
            </circle>
          )
          acc += len
          return el
        })}
      </g>
      <text x={85} y={83} textAnchor="middle" className="fill-ink" fontSize={26} fontWeight={800}>{n(total)}</text>
      <text x={85} y={102} textAnchor="middle" className="fill-muted" fontSize={12}>leads</text>
    </svg>
  )
}

/* ---------- page pieces ---------- */

function Card({ title, hint, children, className = '' }: { title: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6 ${className}`}>
      <h3 className="text-base font-bold">{title}</h3>
      {hint && <p className="mb-4 mt-0.5 text-sm text-muted">{hint}</p>}
      {children}
    </section>
  )
}

function Kpi({ label, value, note, color, to }: { label: string; value: string; note: ReactNode; color: string; to?: string }) {
  const body = (
    <div className="h-full rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:shadow-md" style={{ borderTop: `4px solid ${color}` }}>
      <div className="text-xs font-bold uppercase tracking-widest text-muted">{label}</div>
      <div className="mt-2 text-3xl font-extrabold">{value}</div>
      <div className="mt-1 text-sm text-muted">{note}</div>
    </div>
  )
  return to ? <Link to={to} className="block">{body}</Link> : body
}

export default function Home() {
  const [days, setDays] = useState(30)
  const [source, setSource] = useState('all')
  const [data, setData] = useState<Dash | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let current = true
    setLoading(true)
    const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
    api<Dash>(`/api/dashboard?days=${days}&source=${source}&tz=${tz}`)
      .then((d) => {
        if (!current) return
        setData(d)
        setError('')
      })
      .catch((e: Error) => current && setError(e.message))
      .finally(() => current && setLoading(false))
    return () => {
      current = false
    }
  }, [days, source])

  const buckets = useMemo(() => (data ? toBuckets(data.daily, data.filters.days) : []), [data])
  const unit = days === 90 ? 'leads per week' : days === 0 ? 'leads per month' : 'leads per day'

  const stats = useMemo(() => {
    if (!data) return null
    const { total, byStatus, bySource, previousTotal } = data
    const converted = byStatus.converted ?? 0
    const topSource = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0]
    const topStage = data.statuses.map((s) => ({ s, c: byStatus[s.key] ?? 0 })).sort((a, b) => b.c - a.c)[0]
    const busiest = [...buckets].sort((a, b) => b.count - a.count)[0]
    return { total, converted, topSource, topStage, busiest, previousTotal, fresh: byStatus.new ?? 0 }
  }, [data, buckets])

  const trend = (() => {
    if (!data || data.previousTotal === null) return <>Since your first lead</>
    const diff = data.total - data.previousTotal
    const before = `the ${days} days before`
    if (data.previousTotal === 0) return <>{data.total ? `No leads in ${before}` : 'No leads yet'}</>
    if (diff === 0) return <>Same as {before}</>
    return (
      <span className={diff > 0 ? 'font-semibold text-green-600 dark:text-green-400' : 'font-semibold text-red-600'}>
        {diff > 0 ? '▲' : '▼'} {n(Math.abs(diff))} {diff > 0 ? 'more' : 'fewer'} than {before}
      </span>
    )
  })()

  const stageMax = data ? Math.max(...data.statuses.map((s) => data.byStatus[s.key] ?? 0), 1) : 1
  const sourceParts = data
    ? Object.entries(data.bySource).sort((a, b) => b[1] - a[1]).map(([key, value]) => ({ key, value, color: SOURCE_COLOR[key] ?? '#a28bec' }))
    : []

  return (
    <div className="mx-auto max-w-6xl">
      <PageBanner title="Dashboard" subtitle="See how your leads are doing, in plain numbers and simple charts." />

      {/* filters: stay pinned under the top bar while the page scrolls */}
      <div className="sticky top-[65px] z-10 -mx-1 mb-3 bg-page px-1 py-3">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm sm:p-4">
        <span className="hidden text-sm font-bold sm:inline">Show me</span>
        <div role="group" aria-label="Time period" className="inline-flex rounded-xl border border-line bg-page p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              aria-pressed={days === r.days}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${days === r.days ? 'bg-brand text-on-brand shadow-sm' : 'text-muted hover:text-ink'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="d-source">Source</label>
        <select
          id="d-source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="cursor-pointer rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/25"
        >
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
        {(days !== 30 || source !== 'all') && (
          <button onClick={() => { setDays(30); setSource('all') }} className="rounded-lg px-2 py-1 text-sm font-medium text-brand-text underline">Reset</button>
        )}
        <span className="ml-auto hidden text-sm text-muted sm:inline">
          {data ? `${n(data.total)} ${data.total === 1 ? 'lead' : 'leads'} · ${periodText(days)} · ${SOURCE_OPTIONS.find((o) => o.key === source)?.label.toLowerCase()}` : ''}
        </span>
      </div>
      </div>

      {error && <div role="alert" className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}
      {!data && !error && <p className="text-sm text-muted">Loading…</p>}

      {data && stats && (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          {data.total === 0 ? (
            <div className="rounded-2xl border border-line bg-surface p-10 text-center shadow-sm">
              <h3 className="text-lg font-bold">No leads in this view</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">There are no leads for {periodText(days)} and this source. Try a longer period or all sources.</p>
              <button onClick={() => { setDays(0); setSource('all') }} className="mt-4 rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-page hover:opacity-90">Show all leads</button>
            </div>
          ) : (
            <>
              {/* the four numbers that matter */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi label="Total leads" value={n(stats.total)} note={trend} color="#3b82f6" />
                <Kpi label="Not contacted yet" value={n(stats.fresh)} note={stats.fresh ? 'Waiting for a first call. Open them' : 'Everyone has been contacted'} color="#f59e0b" to="/leads" />
                <Kpi label="Became customers" value={n(stats.converted)} note="Leads that reached Converted" color="#06b6d4" />
                <Kpi label="Success rate" value={`${pct(stats.converted, stats.total)}%`} note={`About ${pct(stats.converted, stats.total)} in every 100 leads became customers`} color="#10b981" />
              </div>

              <Card
                title="Leads over time"
                hint={stats.busiest ? `Each bar is the number of leads that arrived. The busiest was ${stats.busiest.title} with ${stats.busiest.count}.` : undefined}
              >
                <BarChart buckets={buckets} unit={unit} />
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card
                  title="Where your leads are now"
                  hint={`Most leads are in "${stats.topStage.s.label}" (${stats.topStage.c} of ${n(stats.total)}). A longer bar means more leads at that step.`}
                >
                  <ul className="space-y-3">
                    {data.statuses.map((s) => {
                      const c = data.byStatus[s.key] ?? 0
                      return (
                        <li key={s.key} className="flex items-center gap-3 text-sm">
                          <span className="flex w-28 shrink-0 items-center gap-2 font-medium sm:w-32">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                            <span className="truncate">{s.label}</span>
                          </span>
                          <span className="h-6 flex-1 overflow-hidden rounded-md bg-soft" title={`${s.label}: ${c}`}>
                            <span className="block h-full rounded-md transition-all" style={{ width: `${(c / stageMax) * 100}%`, background: s.color, minWidth: c ? 6 : 0 }} />
                          </span>
                          <span className="w-16 shrink-0 text-right tabular-nums"><b>{n(c)}</b> <span className="text-muted">({pct(c, data.total)}%)</span></span>
                        </li>
                      )
                    })}
                  </ul>
                </Card>

                <Card
                  title="Where your leads come from"
                  hint={stats.topSource ? `${sourceOf(stats.topSource[0]).label} brought the most: ${pct(stats.topSource[1], data.total)}% of all leads.` : undefined}
                >
                  <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
                    <Donut parts={sourceParts} total={data.total} />
                    <ul className="w-full max-w-xs space-y-3 text-sm">
                      {sourceParts.map((p) => (
                        <li key={p.key} className="flex items-center gap-3">
                          <SourceIcon source={p.key} size={24} />
                          <span className="flex-1 font-medium">{sourceOf(p.key).label}</span>
                          <span className="tabular-nums"><b>{n(p.value)}</b> <span className="text-muted">({pct(p.value, data.total)}%)</span></span>
                          <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: p.color }} aria-hidden />
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
