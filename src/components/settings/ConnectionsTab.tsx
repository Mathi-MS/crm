import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { api } from '../../api'
import { SourceIcon } from '../brandIcons'

type MetaStatus = {
  connected: boolean
  pageId?: string
  pageName?: string
  verifyToken?: string
  hasAppSecret?: boolean
  connectedAt?: string
}

const inputCls =
  'w-full rounded-[10px] border border-ink/20 bg-surface px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/25'

function Badge({ on }: { on: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${on ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-ink/5 text-muted'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-green-500' : 'bg-muted'}`} />
      {on ? 'Connected' : 'Not connected'}
    </span>
  )
}

function Logo({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg font-extrabold text-white" style={{ background: bg }}>
      {children}
    </span>
  )
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <div>
      <div className="mb-1 text-xs font-bold text-muted">{label}</div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-soft px-3 py-2 text-sm">{value}</code>
        <button type="button" onClick={copy} className="shrink-0 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-ink/5">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function MetaCard() {
  const [status, setStatus] = useState<MetaStatus | null>(null)
  const [open, setOpen] = useState(false)
  const [pageId, setPageId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api<MetaStatus>('/api/integrations/meta')
      .then((s) => {
        setStatus(s)
        setOpen(!s.connected) // not connected yet: show the form straight away
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  const connect = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      setStatus(await api<MetaStatus>('/api/integrations/meta', { method: 'PUT', body: JSON.stringify({ pageId, accessToken, appSecret }) }))
      setAccessToken('')
      setAppSecret('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (!confirm('Disconnect Meta Ads? New leads will stop arriving.')) return
    setBusy(true)
    setError('')
    try {
      setStatus(await api<MetaStatus>('/api/integrations/meta', { method: 'DELETE' }))
      setPageId('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const webhookUrl = `${window.location.origin}/api/webhooks/meta`
  const connected = !!status?.connected
  const showForm = open && !!status

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="flex flex-wrap items-center gap-4 p-5">
        <SourceIcon source="meta" size={48} />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold">Meta Ads · Facebook &amp; Instagram</h3>
          <p className="text-sm text-muted">
            {connected ? <>Receiving leads from <b className="text-ink">{status?.pageName}</b></> : 'Send leads from your Meta lead forms straight into the CRM.'}
          </p>
        </div>
        {status && <Badge on={connected} />}
        {status && (
          <button
            onClick={() => {
              setOpen((o) => !o)
              setError('')
              if (connected) setPageId(status.pageId ?? '')
            }}
            className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-ink/5"
          >
            {open ? 'Close' : connected ? 'Manage' : 'Connect'}
          </button>
        )}
      </div>

      {error && <div role="alert" className="mx-5 mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}
      {!status && !error && <p className="px-5 pb-5 text-sm text-muted">Loading…</p>}

      {showForm && (
        <div className="space-y-5 border-t border-line bg-page/50 p-5">
          {connected && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="mb-3 text-sm font-bold">Webhook · set this in your Meta app</div>
              <div className="space-y-3">
                <CopyField label="Callback URL" value={webhookUrl} />
                <CopyField label="Verify token" value={status?.verifyToken ?? ''} />
              </div>
              <p className="mt-3 text-xs text-muted">
                Meta for Developers → your app → Webhooks → Page → subscribe to <b>leadgen</b>. Meta needs a public HTTPS address, so on your own computer use a tunnel such as ngrok and put that address in place of localhost.
              </p>
              {!status?.hasAppSecret && (
                <p className="mt-2 text-xs text-amber-600">No App Secret saved, so incoming webhooks are not signature-checked. Add it below.</p>
              )}
              <button onClick={disconnect} disabled={busy} className="mt-4 rounded-xl border border-red-500/40 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50">
                Disconnect
              </button>
            </div>
          )}

          <form onSubmit={connect} className="space-y-4">
            <div className="text-sm font-bold">{connected ? 'Update connection' : 'Connect your page'}</div>
            <div>
              <label htmlFor="pageId" className="mb-1 block text-sm font-bold">Facebook Page ID</label>
              <input id="pageId" className={inputCls} inputMode="numeric" placeholder="e.g. 123456789012345" value={pageId} onChange={(e) => setPageId(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="token" className="mb-1 block text-sm font-bold">Page access token</label>
              <input id="token" type="password" autoComplete="off" className={inputCls} placeholder="Long-lived Page access token" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} required />
              <p className="mt-1 text-xs text-muted">Needs pages_show_list, pages_manage_metadata and leads_retrieval. Stored on your server only.</p>
            </div>
            <div>
              <label htmlFor="secret" className="mb-1 block text-sm font-bold">App Secret <span className="font-normal text-muted">(recommended)</span></label>
              <input id="secret" type="password" autoComplete="off" className={inputCls} placeholder="Meta app → Settings → Basic" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} />
              <p className="mt-1 text-xs text-muted">Used to check that webhook calls really come from Meta.</p>
            </div>
            <button disabled={busy} className="rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-page hover:opacity-90 disabled:opacity-50">
              {busy ? 'Saving…' : connected ? 'Save changes' : 'Connect Meta Ads'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

type GoogleStatus = { connected: boolean; webhookKey?: string; connectedAt?: string }

function GoogleCard() {
  const [status, setStatus] = useState<GoogleStatus | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api<GoogleStatus>('/api/integrations/google')
      .then(setStatus)
      .catch((e: Error) => setError(e.message))
  }, [])

  const run = async (fn: () => Promise<GoogleStatus>) => {
    setBusy(true)
    setError('')
    try {
      setStatus(await fn())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const connect = () => run(async () => { const s = await api<GoogleStatus>('/api/integrations/google', { method: 'PUT', body: '{}' }); setOpen(true); return s })
  const regenerate = () => {
    if (!confirm('Create a new key? The old one stops working, so update it in Google Ads too.')) return
    run(() => api<GoogleStatus>('/api/integrations/google', { method: 'PUT', body: JSON.stringify({ regenerate: true }) }))
  }
  const disconnect = () => {
    if (!confirm('Disconnect Google Ads? New leads will stop arriving.')) return
    run(async () => { const s = await api<GoogleStatus>('/api/integrations/google', { method: 'DELETE' }); setOpen(false); return s })
  }

  const connected = !!status?.connected
  const webhookUrl = `${window.location.origin}/api/webhooks/google`

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="flex flex-wrap items-center gap-4 p-5">
        <SourceIcon source="google" size={48} />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold">Google Ads · Lead forms</h3>
          <p className="text-sm text-muted">
            {connected ? 'Receiving leads from your Google Ads lead forms.' : 'Send leads from Google Ads lead form assets into the CRM.'}
          </p>
        </div>
        {status && <Badge on={connected} />}
        {status && (connected ? (
          <button onClick={() => setOpen((o) => !o)} className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-ink/5">
            {open ? 'Close' : 'Manage'}
          </button>
        ) : (
          <button onClick={connect} disabled={busy} className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-page hover:opacity-90 disabled:opacity-50">
            {busy ? 'Connecting…' : 'Connect'}
          </button>
        ))}
      </div>

      {error && <div role="alert" className="mx-5 mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}
      {!status && !error && <p className="px-5 pb-5 text-sm text-muted">Loading…</p>}

      {connected && open && (
        <div className="space-y-4 border-t border-line bg-page/50 p-5">
          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="mb-3 text-sm font-bold">Paste these into Google Ads</div>
            <div className="space-y-3">
              <CopyField label="Webhook URL" value={webhookUrl} />
              <CopyField label="Key" value={status?.webhookKey ?? ''} />
            </div>
            <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-muted">
              <li>In Google Ads, open your lead form asset and choose <b>Lead delivery option → Webhook integration</b>.</li>
              <li>Paste the Webhook URL and the Key, then click <b>Send test data</b>. A test lead appears on the Leads page.</li>
              <li>Save the form. New leads arrive here automatically.</li>
            </ol>
            <p className="mt-3 text-xs text-muted">
              Google needs a public HTTPS address, so on your own computer use a tunnel such as ngrok and use that address in place of localhost.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={regenerate} disabled={busy} className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-ink/5 disabled:opacity-50">
              Regenerate key
            </button>
            <button onClick={disconnect} disabled={busy} className="rounded-xl border border-red-500/40 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50">
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const SOON = [
  { name: 'LinkedIn Lead Gen', desc: 'Capture leads from LinkedIn forms.', bg: '#0a66c2', mark: 'in' },
  { name: 'WhatsApp Business', desc: 'Chat with leads right from the CRM.', bg: '#25d366', mark: 'W' },
]

export default function ConnectionsTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Connect your ad and messaging accounts so new leads land in the CRM automatically.</p>
      <MetaCard />
      <GoogleCard />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SOON.map((s) => (
          <div key={s.name} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 opacity-70 shadow-sm">
            <Logo bg={s.bg}>{s.mark}</Logo>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold">{s.name}</h3>
              <p className="text-xs text-muted">{s.desc}</p>
            </div>
            <span className="shrink-0 rounded-full bg-ink/5 px-2.5 py-1 text-[11px] font-bold text-muted">Soon</span>
          </div>
        ))}
      </div>
    </div>
  )
}
