import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import Modal, { fieldCls } from '../components/Modal'

type RoleRow = { id: string; name: string; description: string; isAdmin: boolean; isSystem: boolean; userCount: number }

function RoleForm({ role, onDone, onClose }: { role: RoleRow | null; onDone: () => void; onClose: () => void }) {
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [isAdmin, setIsAdmin] = useState(role?.isAdmin ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const locked = !!role?.isSystem

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api(role ? `/api/roles/${role.id}` : '/api/roles', {
        method: role ? 'PUT' : 'POST',
        body: JSON.stringify({ name, description, isAdmin }),
      })
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={role ? 'Edit role' : 'Add role'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="r-name" className="mb-1 block text-sm font-bold">Role name</label>
          <input id="r-name" className={`${fieldCls} disabled:opacity-60`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales Manager" maxLength={40} required disabled={locked} autoFocus={!locked} />
        </div>
        <div>
          <label htmlFor="r-desc" className="mb-1 block text-sm font-bold">Description <span className="font-normal text-muted">(optional)</span></label>
          <input id="r-desc" className={fieldCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role is for" maxLength={200} />
        </div>
        <label className={`flex items-start gap-3 rounded-xl border border-line p-3 ${locked ? 'opacity-60' : 'cursor-pointer'}`}>
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} disabled={locked} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
          <span>
            <span className="block text-sm font-bold">Administrator access</span>
            <span className="block text-xs text-muted">Can manage users, roles (Masters) and connections.</span>
          </span>
        </label>
        {locked && <p className="text-xs text-muted">This is the built-in Admin role. Only its description can be changed.</p>}

        {error && <div role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium hover:bg-ink/5">Cancel</button>
          <button disabled={busy} className="rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-page hover:opacity-90 disabled:opacity-50">
            {busy ? 'Saving…' : role ? 'Save changes' : 'Create role'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function RolesMaster() {
  const [roles, setRoles] = useState<RoleRow[] | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<RoleRow | 'new' | null>(null)

  const load = useCallback(async () => {
    try {
      setRoles((await api<{ roles: RoleRow[] }>('/api/roles')).roles)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (r: RoleRow) => {
    if (!confirm(`Delete the role “${r.name}”?`)) return
    setError('')
    try {
      await api(`/api/roles/${r.id}`, { method: 'DELETE' })
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Roles you create here can be given to users on the Users page.</p>
        <button onClick={() => setEditing('new')} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-on-brand hover:opacity-90">
          + Add role
        </button>
      </div>

      {error && <div role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}
      {!roles && !error && <p className="text-sm text-muted">Loading…</p>}

      {roles && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="bg-soft text-xs uppercase tracking-widest text-muted">
                <tr>
                  {['Role', 'Description', 'Access', 'Users', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="px-4 py-3 font-medium">
                      {r.name} {r.isSystem && <span className="ml-1 rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-bold text-muted">Built-in</span>}
                    </td>
                    <td className="px-4 py-3 text-muted">{r.description || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${r.isAdmin ? 'bg-brand/25' : 'bg-ink/5 text-muted'}`}>{r.isAdmin ? 'Administrator' : 'Standard'}</span>
                    </td>
                    <td className="px-4 py-3">{r.userCount}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button onClick={() => setEditing(r)} className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-ink/5">Edit</button>
                      {!r.isSystem && (
                        <button onClick={() => remove(r)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-500/10">Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <RoleForm
          role={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

export default function Roles() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 overflow-hidden rounded-2xl bg-sidebar p-6 text-white shadow-sm sm:p-8">
        <div className="relative">
          <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-brand/40 blur-3xl" aria-hidden />
          <h2 className="relative text-2xl font-extrabold tracking-tight sm:text-3xl">Roles</h2>
          <p className="relative mt-1 max-w-md text-sm text-white/60">Create the roles your team members can be given, and choose who gets administrator access.</p>
        </div>
      </div>

      <RolesMaster />
    </div>
  )
}
