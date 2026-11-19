import { useSyncExternalStore } from 'react'
import { api } from './api'

export type Me = {
  id: string
  name: string
  email: string
  role: { id: string; name: string; isAdmin: boolean } | null
}

const KEY = 'user'
const listeners = new Set<() => void>()

let cachedRaw: string | null = null
let cached: Me | null = null

export function getMe(): Me | null {
  const raw = localStorage.getItem(KEY)
  if (raw !== cachedRaw) {
    cachedRaw = raw
    try {
      cached = raw ? (JSON.parse(raw) as Me) : null
    } catch {
      cached = null
    }
  }
  return cached
}

export function setMe(me: Me | null) {
  if (me) localStorage.setItem(KEY, JSON.stringify(me))
  else localStorage.removeItem(KEY)
  listeners.forEach((l) => l())
}

/** Re-read the user and role from the server (rights may have changed). */
export async function refreshMe() {
  try {
    const { user } = await api<{ user: Me }>('/api/auth/me')
    setMe(user)
  } catch {
    /* keep the cached copy; api() already logs out on 401 */
  }
}

export function useMe() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getMe,
  )
}

export const isAdmin = (me: Me | null) => !!me?.role?.isAdmin
