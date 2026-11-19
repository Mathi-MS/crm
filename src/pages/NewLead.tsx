import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { PageBanner, type Status } from '../components/leadKit'
import { fieldCls } from '../components/Modal'

/** Add a lead by hand: a phone call, a walk-in, a referral. */
export default function NewLead() {
  const navigate = useNavigate()
  const [statuses, setStatuses] = useState<Status[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState('new')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ statuses: Status[] }>('/api/leads/statuses')
      .then((d) => setStatuses(d.statuses))
      .catch((e: Error) => setError(e.message))
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api('/api/leads', { method: 'POST', body: JSON.stringify({ name, email, phone, status }) })
      navigate('/leads')
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageBanner title="New lead" subtitle="Add a lead you got by phone, in person or from a referral." />

      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6" noValidate>
        <div>
          <label htmlFor="l-name" className="mb-1.5 block text-sm font-bold">Name</label>
          <input id="l-name" className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" maxLength={80} autoFocus />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="l-email" className="mb-1.5 block text-sm font-bold">Email</label>
            <input id="l-email" type="email" className={fieldCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <div>
            <label htmlFor="l-phone" className="mb-1.5 block text-sm font-bold">Phone</label>
            <input id="l-phone" type="tel" className={fieldCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted">Enter at least an email or a phone number.</p>

        <div>
          <label htmlFor="l-status" className="mb-1.5 block text-sm font-bold">Status</label>
          <select
            id="l-status"
            className={`${fieldCls} cursor-pointer`}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ borderLeft: `4px solid ${statuses.find((s) => s.key === status)?.color ?? 'transparent'}` }}
          >
            {statuses.length === 0 && <option value="new">New Lead</option>}
            {statuses.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>

        {error && <div role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <Link to="/leads" className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium hover:bg-ink/5">Cancel</Link>
          <button disabled={busy} className="rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-page hover:opacity-90 disabled:opacity-50">
            {busy ? 'Saving…' : 'Save lead'}
          </button>
        </div>
      </form>
    </div>
  )
}
