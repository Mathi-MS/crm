import { useEffect, type ReactNode } from 'react'
import { ACCENTS, DEFAULTS, FONTS, ensureFont, resetPrefs, setPrefs, usePrefs, useSyncState, type TextSize, type ThemeMode } from '../../theme'

const card = 'rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6'

function Section({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <section className={card}>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mb-4 mt-0.5 text-sm text-muted">{desc}</p>
      {children}
    </section>
  )
}

const ring = (on: boolean) =>
  on ? 'border-brand ring-4 ring-brand/25' : 'border-line hover:border-ink/30'

/* little app mock-up used in the theme cards */
function Mock({ dark }: { dark: boolean }) {
  const c = dark
    ? { bg: '#0e0e13', side: '#0a0a0e', card: '#17171e', line: '#2c2c38' }
    : { bg: '#f4f1fd', side: '#141414', card: '#ffffff', line: '#e2dcf6' }
  return (
    <div className="flex h-24 w-full overflow-hidden rounded-lg" style={{ background: c.bg }}>
      <div className="w-[22%] space-y-1 p-1.5" style={{ background: c.side }}>
        <div className="h-1.5 w-full rounded-full bg-brand" />
        <div className="h-1 w-3/4 rounded-full bg-white/30" />
        <div className="h-1 w-2/3 rounded-full bg-white/30" />
      </div>
      <div className="flex-1 space-y-1.5 p-2">
        <div className="h-2 w-1/3 rounded-full" style={{ background: c.line }} />
        <div className="grid grid-cols-3 gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-6 rounded" style={{ background: c.card }} />
          ))}
        </div>
        <div className="h-7 rounded" style={{ background: c.card }} />
      </div>
    </div>
  )
}

const MODES: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
]

const SIZE_OPTS: { id: TextSize; label: string; px: string }[] = [
  { id: 'sm', label: 'Small', px: 'text-xs' },
  { id: 'md', label: 'Medium', px: 'text-base' },
  { id: 'lg', label: 'Large', px: 'text-xl' },
]

export default function AppearanceTab() {
  const prefs = usePrefs()
  const sync = useSyncState()

  // load every font so the previews render in their own typeface
  useEffect(() => FONTS.forEach((f) => ensureFont(f.id)), [])

  const customAccent = !ACCENTS.some((a) => a.value.toLowerCase() === prefs.accent.toLowerCase())
  const changed = JSON.stringify(prefs) !== JSON.stringify(DEFAULTS)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Changes apply instantly and are saved to your account.{' '}
          <span className={sync === 'error' ? 'font-medium text-red-600' : 'font-medium text-ink'}>
            {sync === 'saving' && 'Saving…'}
            {sync === 'saved' && '✓ Saved'}
            {sync === 'error' && 'Could not save. Check your connection.'}
          </span>
        </p>
        <button
          onClick={resetPrefs}
          disabled={!changed}
          className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-ink/5 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Reset to defaults
        </button>
      </div>

      <Section title="Theme" desc="Choose light, dark, or follow your device.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setPrefs({ mode: m.id })}
              aria-pressed={prefs.mode === m.id}
              className={`rounded-xl border-2 p-2 text-left transition ${ring(prefs.mode === m.id)}`}
            >
              {m.id === 'system' ? (
                <div className="relative">
                  <Mock dark={false} />
                  <div className="absolute inset-0" style={{ clipPath: 'polygon(55% 0, 100% 0, 100% 100%, 40% 100%)' }}>
                    <Mock dark />
                  </div>
                </div>
              ) : (
                <Mock dark={m.id === 'dark'} />
              )}
              <div className="mt-2 flex items-center gap-2 px-1 text-sm font-bold">
                <span className={`grid h-4 w-4 place-items-center rounded-full border-2 ${prefs.mode === m.id ? 'border-brand bg-brand' : 'border-ink/30'}`}>
                  {prefs.mode === m.id && <span className="h-1.5 w-1.5 rounded-full bg-on-brand" />}
                </span>
                {m.label}
              </div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Accent color" desc="Used for buttons, highlights and the active menu item.">
        <div className="flex flex-wrap items-center gap-3">
          {ACCENTS.map((a) => {
            const on = prefs.accent.toLowerCase() === a.value.toLowerCase()
            return (
              <button
                key={a.value}
                onClick={() => setPrefs({ accent: a.value })}
                title={a.name}
                aria-label={a.name}
                aria-pressed={on}
                className={`grid h-10 w-10 place-items-center rounded-full border-2 transition ${on ? 'border-ink' : 'border-transparent hover:scale-110'}`}
                style={{ background: a.value }}
              >
                {on && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                )}
              </button>
            )
          })}
          <label
            title="Custom color"
            className={`relative grid h-10 w-10 cursor-pointer place-items-center overflow-hidden rounded-full border-2 ${customAccent ? 'border-ink' : 'border-dashed border-ink/30'}`}
            style={{ background: customAccent ? prefs.accent : 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}
          >
            <input
              type="color"
              value={prefs.accent}
              onChange={(e) => setPrefs({ accent: e.target.value })}
              aria-label="Custom accent color"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
          <code className="rounded-lg bg-soft px-2.5 py-1 text-xs text-muted">{prefs.accent.toUpperCase()}</code>
        </div>
      </Section>

      <Section title="Font" desc="Pick the typeface used across the whole app.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {FONTS.map((f) => (
            <button
              key={f.id}
              onClick={() => setPrefs({ font: f.id })}
              aria-pressed={prefs.font === f.id}
              className={`rounded-xl border-2 p-4 text-left transition ${ring(prefs.font === f.id)}`}
            >
              <div className="text-3xl font-bold leading-none" style={{ fontFamily: f.stack }}>Aa</div>
              <div className="mt-3 truncate text-sm font-bold" style={{ fontFamily: f.stack }}>{f.label}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Text size" desc="Make everything a little smaller or larger.">
        <div className="inline-flex rounded-xl border border-line bg-soft p-1">
          {SIZE_OPTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setPrefs({ size: s.id })}
              aria-pressed={prefs.size === s.id}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                prefs.size === s.id ? 'bg-brand text-on-brand shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              <span className={`${s.px} font-bold leading-none`}>A</span>
              {s.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Live preview" desc="This is how your choices look together.">
        <div className="rounded-xl border border-line bg-page p-5">
          <div className="text-lg font-extrabold">New lead from Meta Ads</div>
          <p className="mt-1 text-sm text-muted">Jane Doe · jane@example.com · just now</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-on-brand">Follow up</button>
            <button className="rounded-xl border border-line px-4 py-2 text-sm font-medium">Archive</button>
            <span className="rounded-full bg-brand/25 px-2.5 py-0.5 text-xs font-bold">New</span>
            <a href="#" onClick={(e) => e.preventDefault()} className="text-sm font-medium text-brand-text underline">View details</a>
          </div>
        </div>
      </Section>
    </div>
  )
}
