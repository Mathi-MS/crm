import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { getMe } from '../auth'
import Modal, { fieldCls } from '../components/Modal'

type Role = { id: string; name: string; isAdmin: boolean }
type UserRow = { id: string; name: string; email: string; role: Role | null; isActive: boolean; lastLoginAt: string | null; createdAt: string }
type RoleRow = Role & { description: string; isSystem: boolean; userCount: number }

function ago(iso: string | null) {
  if (!iso) return 'Never'
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`
  return new Date(iso).toLocaleDateString()
}

function Switch({ on, disabled, label, onChange }: { on: boolean; disabled?: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={disabled ? 'You cannot deactivate your own account' : label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'bg-brand' : 'bg-ink/20'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

function UserForm({ user, roles, onDone, onClose }: { user: UserRow | null; roles: RoleRow[]; onDone: () => void; onClose: () => void }) {
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState(user?.role?.id ?? '')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api(user ? `/api/users/${user.id}` : '/api/users', {
        method: user ? 'PUT' : 'POST',
        body: JSON.stringify({ name, email, role, password }),
      })
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={user ? 'Edit user' : 'Add user'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="u-name" className="mb-1 block text-sm font-bold">Name</label>
          <input id="u-name" className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required autoFocus />
        </div>
        <div>
          <label htmlFor="u-email" className="mb-1 block text-sm font-bold">Email</label>
          <input id="u-email" type="email" className={fieldCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" required />
        </div>
        <div>
          <label htmlFor="u-role" className="mb-1 block text-sm font-bold">Role</label>
          <select id="u-role" className={fieldCls} value={role} onChange={(e) => setRole(e.target.value)} required>
            <option value="" disabled>Select a role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}{r.isAdmin ? ' (admin)' : ''}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            Need another role? Add it under <Link to="/roles" className="font-medium text-brand-text underline">Roles</Link>.
          </p>
        </div>
        <div>
          <label htmlFor="u-pass" className="mb-1 block text-sm font-bold">
            {user ? 'New password' : 'Password'} {user && <span className="font-normal text-muted">(leave blank to keep the current one)</span>}
          </label>
          <div className="relative">
            <input
              id="u-pass"
              type={show ? 'text' : 'password'}
              className={`${fieldCls} pr-16`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required={!user}
              minLength={user ? undefined : 8}
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-muted hover:text-ink">
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && <div role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium hover:bg-ink/5">Cancel</button>
          <button disabled={busy} className="rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-page hover:opacity-90 disabled:opacity-50">
            {busy ? 'Saving…' : user ? 'Save changes' : 'Create user'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Users() {
  const [users, setUsers] = useState<UserRow[] | null>(null)
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<UserRow | 'new' | null>(null)
  const me = getMe()

  const load = useCallback(async () => {
    try {
      const [u, r] = await Promise.all([api<{ users: UserRow[] }>('/api/users'), api<{ roles: RoleRow[] }>('/api/roles')])
      setUsers(u.users)
      setRoles(r.roles)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (u: UserRow) => {
    if (!confirm(`Delete ${u.name || u.email}? They will no longer be able to log in.`)) return
    setError('')
    try {
      await api(`/api/users/${u.id}`, { method: 'DELETE' })
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const toggle = async (u: UserRow) => {
    setError('')
    const next = !u.isActive
    // show the change immediately, roll back if the server says no
    setUsers((list) => list && list.map((x) => (x.id === u.id ? { ...x, isActive: next } : x)))
    try {
      await api(`/api/users/${u.id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive: next }) })
    } catch (e) {
      setUsers((list) => list && list.map((x) => (x.id === u.id ? { ...x, isActive: u.isActive } : x)))
      setError((e as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 overflow-hidden rounded-2xl bg-sidebar p-6 text-white shadow-sm sm:p-8">
        <div className="relative">
          <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-brand/40 blur-3xl" aria-hidden />
          <h2 className="relative text-2xl font-extrabold tracking-tight sm:text-3xl">Users</h2>
          <p className="relative mt-1 max-w-md text-sm text-white/60">Create logins for your team and choose what each person can do.</p>
        </div>
      </div>

      <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{users ? `${users.length} user${users.length === 1 ? '' : 's'}` : ''}</p>
        <button onClick={() => setEditing('new')} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-on-brand hover:opacity-90">
          + Add user
        </button>
      </div>

      {error && <div role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}
      {!users && !error && <p className="text-sm text-muted">Loading…</p>}

      {users && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-soft text-xs uppercase tracking-widest text-muted">
                <tr>
                  {['Name', 'Email', 'Role', 'Status', 'Last login', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={`border-t border-line ${u.isActive ? '' : 'bg-ink/[0.03]'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-on-brand">
                          {(u.name || u.email).charAt(0).toUpperCase()}
                        </span>
                        <span className="font-medium">{u.name || '—'}{u.id === me?.id && <span className="ml-2 text-xs text-muted">(you)</span>}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.role ? (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${u.role.isAdmin ? 'bg-brand/25' : 'bg-ink/5 text-muted'}`}>{u.role.name}</span>
                      ) : (
                        <span className="text-xs text-muted">No role</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          on={u.isActive}
                          disabled={u.id === me?.id}
                          label={u.isActive ? `Deactivate ${u.name || u.email}` : `Activate ${u.name || u.email}`}
                          onChange={() => toggle(u)}
                        />
                        <span className={`text-xs font-bold ${u.isActive ? 'text-green-600 dark:text-green-400' : 'text-muted'}`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted" title={u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'This user has not logged in yet'}>
                      {ago(u.lastLoginAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button onClick={() => setEditing(u)} className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-ink/5">Edit</button>
                      {u.id !== me?.id && (
                        <button onClick={() => remove(u)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-500/10">Delete</button>
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
        <UserForm
          user={editing === 'new' ? null : editing}
          roles={roles}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            load()
          }}
        />
      )}
      </div>
    </div>
  )
}
