import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { clearLocalPrefs, loadPrefsFromServer } from '../theme'
import { isAdmin, refreshMe, setMe, useMe } from '../auth'

const icons = {
  home: <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.5.6 4 2.5 4 6" /></>,
  leads: <path d="M3 4h18l-7 9v6l-4 2v-8L3 4z" />,
  connections: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  kanban: <><rect x="3" y="3" width="5" height="18" rx="1.5" /><rect x="10" y="3" width="5" height="11" rx="1.5" /><rect x="17" y="3" width="4" height="15" rx="1.5" /></>,
  plus: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  roles: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />,
  masters: <path d="M12 3l9 5-9 5-9-5 9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
}

type NavItem = { to: string; label: string; title?: string; icon: React.ReactNode; end?: boolean; admin?: boolean }
type NavGroup = { group: string; icon: React.ReactNode; items: NavItem[]; admin?: boolean }

const nav: (NavItem | NavGroup)[] = [
  { to: '/', label: 'Home', icon: icons.home, end: true },
  {
    group: 'Leads',
    icon: icons.leads,
    items: [
      { to: '/leads', label: 'New lead', title: 'Leads', icon: icons.leads, end: true },
      { to: '/kanban', label: 'Kanban board', icon: icons.kanban },
    ],
  },
  {
    group: 'Masters',
    icon: icons.masters,
    admin: true,
    items: [
      { to: '/roles', label: 'Roles', icon: icons.roles },
      { to: '/users', label: 'Users', icon: icons.users },
    ],
  },
  { to: '/connections', label: 'Connections', icon: icons.connections, admin: true },
  { to: '/settings', label: 'Settings', icon: icons.settings },
]
// every page, flat, for the title in the top bar
const pages: NavItem[] = [...nav.flatMap((n) => ('group' in n ? n.items : [n])), { to: '/leads/new', label: 'New lead', icon: icons.plus }]

const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
)

export default function AppLayout() {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar-collapsed') === '1'
    } catch {
      return false
    }
  })
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem('sidebar-collapsed', c ? '0' : '1')
      } catch {
        /* ignore */
      }
      return !c
    })
  const hide = collapsed ? 'lg:hidden' : ''
  const navigate = useNavigate()
  const me = useMe()
  // hide what this user may not open: admin-only pages, and groups left with nothing in them
  const visibleNav = nav.flatMap((n): (NavItem | NavGroup)[] => {
    if (!('group' in n)) return !n.admin || isAdmin(me) ? [n] : []
    if (n.admin && !isAdmin(me)) return []
    const items = n.items.filter((i) => !i.admin || isAdmin(me))
    return items.length ? [{ ...n, items }] : []
  })
  const { pathname } = useLocation()
  // dropdown groups that are open; a group opens by itself when you are on one of its pages
  const [openGroups, setOpenGroups] = useState<string[]>(() =>
    nav.flatMap((n) => ('group' in n && n.items.some((i) => pathname.startsWith(i.to)) ? [n.group] : [])),
  )
  const toggleGroup = (g: string) => setOpenGroups((o) => (o.includes(g) ? o.filter((x) => x !== g) : [...o, g]))
  useEffect(() => {
    const g = nav.find((n): n is NavGroup => 'group' in n && n.items.some((i) => pathname.startsWith(i.to)))
    if (g) setOpenGroups((o) => (o.includes(g.group) ? o : [...o, g.group]))
  }, [pathname])
  useEffect(() => {
    loadPrefsFromServer()
    refreshMe() // rights may have changed since the last login
  }, [])
  // the most specific page wins, so /leads/new is "New lead" and not "Leads"
  const current = pages
    .filter((l) => (l.end ? pathname === l.to : pathname.startsWith(l.to)))
    .sort((x, y) => y.to.length - x.to.length)[0]
  const title = current?.title ?? current?.label ?? ''

  const user = me ?? { name: '', email: '' }
  const initial = (user.name || user.email || '?').charAt(0).toUpperCase()

  const logout = () => {
    localStorage.removeItem('token')
    setMe(null)
    clearLocalPrefs()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-page text-ink lg:flex">
      {/* mobile backdrop */}
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-white transition-[transform,width] duration-200 lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 ${
          collapsed ? 'lg:w-20' : ''
        } ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className={`py-6 text-2xl font-extrabold tracking-tight ${collapsed ? 'px-6 lg:px-0 lg:text-center' : 'px-6'}`}>
          {collapsed ? <><span className="lg:hidden">brando.</span><span className="hidden lg:inline">b.</span></> : 'brando.'}
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {visibleNav.map((n) => {
            if (!('group' in n)) {
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  onClick={() => setOpen(false)}
                  title={n.label}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${collapsed ? 'lg:justify-center lg:px-0' : ''} ${
                      isActive ? 'bg-brand text-on-brand' : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <Icon>{n.icon}</Icon>
                  <span className={hide}>{n.label}</span>
                </NavLink>
              )
            }

            const isOpen = openGroups.includes(n.group)
            const childActive = n.items.some((i) => pathname.startsWith(i.to))
            return (
              <div key={n.group}>
                {/* dropdown header (hidden when the sidebar is collapsed to icons) */}
                <button
                  type="button"
                  onClick={() => toggleGroup(n.group)}
                  aria-expanded={isOpen}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${collapsed ? 'lg:hidden' : ''} ${
                    childActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon>{n.icon}</Icon>
                  <span className="flex-1 text-left">{n.group}</span>
                  <svg className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {isOpen && (
                  <div className={`ml-6 mt-1 flex flex-col gap-1 border-l border-white/10 pl-2 ${collapsed ? 'lg:hidden' : ''}`}>
                    {n.items.map((i) => (
                      <NavLink
                        key={i.to}
                        to={i.to}
                        end={i.end}
                        onClick={() => setOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            isActive ? 'bg-brand text-on-brand' : 'text-white/70 hover:bg-white/10 hover:text-white'
                          }`
                        }
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{i.icon}</svg>
                        {i.label}
                      </NavLink>
                    ))}
                  </div>
                )}

                {/* collapsed to icons: show the group's pages as plain icons */}
                {collapsed && (
                  <div className="hidden flex-col gap-1 lg:flex">
                    {n.items.map((i) => (
                      <NavLink
                        key={i.to}
                        to={i.to}
                        end={i.end}
                        title={i.label}
                        className={({ isActive }) =>
                          `flex items-center justify-center rounded-xl py-2.5 transition-colors ${
                            isActive ? 'bg-brand text-on-brand' : 'text-white/70 hover:bg-white/10 hover:text-white'
                          }`
                        }
                      >
                        <Icon>{i.icon}</Icon>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className={`mb-3 flex items-center gap-3 ${collapsed ? 'lg:justify-center' : ''}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand font-bold text-on-brand">{initial}</span>
            <div className={`min-w-0 ${hide}`}>
              <div className="truncate text-sm font-bold">{user.name || 'User'}</div>
              <div className="truncate text-xs text-white/60">{user.email}</div>
            </div>
          </div>
          <button onClick={logout} title="Log out" className="w-full rounded-xl border border-white/20 py-2 text-sm font-medium hover:bg-white/10">
            <span className={hide}>Log out</span>
            <svg className={`mx-auto hidden ${collapsed ? 'lg:block' : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" /></svg>
          </button>
        </div>
      </aside>

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface/80 px-4 py-3 backdrop-blur sm:px-8">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="grid h-10 w-10 place-items-center rounded-lg border border-line lg:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden h-10 w-10 place-items-center rounded-lg border border-line hover:bg-ink/5 lg:grid"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {collapsed ? <path d="M5 5l7 7-7 7M13 5l7 7-7 7" /> : <path d="M19 5l-7 7 7 7M11 5l-7 7 7 7" />}
            </svg>
          </button>
          <h1 className="text-xl font-bold">{title}</h1>
        </header>
        <main className="flex-1 p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
