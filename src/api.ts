// Small fetch wrapper: adds the login token and logs out on 401.
const BASE =  'https://crm-server-v8ck.onrender.com'

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token')
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('crm-prefs')
    window.location.hash = '#/login'
  }
  if (!res.ok) throw new Error((data as { message?: string }).message || 'Request failed.')
  return data as T
}
