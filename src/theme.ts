import { useSyncExternalStore } from 'react'
import { api } from './api'

export type ThemeMode = 'light' | 'dark' | 'system'
export type TextSize = 'sm' | 'md' | 'lg'
export type Prefs = { mode: ThemeMode; accent: string; font: string; size: TextSize }

export const DEFAULTS: Prefs = { mode: 'light', accent: '#a28bec', font: 'satoshi', size: 'md' }

export const FONTS = [
  { id: 'satoshi', label: 'Satoshi', stack: '"Satoshi", ui-sans-serif, system-ui, sans-serif' },
  { id: 'inter', label: 'Inter', stack: '"Inter", ui-sans-serif, system-ui, sans-serif', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap' },
  { id: 'poppins', label: 'Poppins', stack: '"Poppins", ui-sans-serif, system-ui, sans-serif', href: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap' },
  { id: 'dmsans', label: 'DM Sans', stack: '"DM Sans", ui-sans-serif, system-ui, sans-serif', href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap' },
  { id: 'space', label: 'Space Grotesk', stack: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif', href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap' },
  { id: 'lora', label: 'Lora (serif)', stack: '"Lora", Georgia, serif', href: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap' },
  { id: 'system', label: 'System', stack: 'system-ui, "Segoe UI", Roboto, sans-serif' },
  { id: 'mono', label: 'Mono', stack: 'ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace' },
] as const

export const ACCENTS = [
  { name: 'Purple', value: '#a28bec' },
  { name: 'Blue', value: '#5b9cf5' },
  { name: 'Teal', value: '#2dc4b2' },
  { name: 'Green', value: '#3ecf7a' },
  { name: 'Orange', value: '#f59e4b' },
  { name: 'Pink', value: '#f472b6' },
  { name: 'Red', value: '#f0645a' },
  { name: 'Slate', value: '#8b95a7' },
] as const

const SIZES: Record<TextSize, string> = { sm: '14px', md: '16px', lg: '18px' }
const KEY = 'crm-prefs'

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)

function load(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    return {
      mode: ['light', 'dark', 'system'].includes(raw.mode) ? raw.mode : DEFAULTS.mode,
      accent: isHex(raw.accent) ? raw.accent : DEFAULTS.accent,
      font: FONTS.some((f) => f.id === raw.font) ? raw.font : DEFAULTS.font,
      size: ['sm', 'md', 'lg'].includes(raw.size) ? raw.size : DEFAULTS.size,
    }
  } catch {
    return DEFAULTS
  }
}

// readable text colour on top of the accent
function inkFor(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.5 ? '#0a0a0a' : '#ffffff'
}

const loaded = new Set<string>()
export function ensureFont(id: string) {
  const f = FONTS.find((x) => x.id === id)
  if (!f || !('href' in f) || loaded.has(id)) return
  loaded.add(id)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = f.href
  document.head.appendChild(link)
}

export function applyPrefs(p: Prefs) {
  const root = document.documentElement
  const dark = p.mode === 'dark' || (p.mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.dataset.theme = dark ? 'dark' : 'light'
  root.style.colorScheme = dark ? 'dark' : 'light'
  root.style.setProperty('--accent', p.accent)
  root.style.setProperty('--accent-ink', inkFor(p.accent))
  ensureFont(p.font)
  root.style.setProperty('--app-font', (FONTS.find((f) => f.id === p.font) ?? FONTS[0]).stack)
  root.style.fontSize = SIZES[p.size]
}

let prefs = load()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export type SyncState = 'idle' | 'saving' | 'saved' | 'error'
let sync: SyncState = 'idle'
const setSync = (s: SyncState) => {
  sync = s
  emit()
}

function commit(next: Prefs) {
  prefs = next
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    /* storage unavailable */
  }
  applyPrefs(prefs)
  emit()
}

// save to the server shortly after the last change
let timer: ReturnType<typeof setTimeout> | undefined
function scheduleSave() {
  if (!localStorage.getItem('token')) return
  setSync('saving')
  clearTimeout(timer)
  timer = setTimeout(async () => {
    try {
      await api('/api/settings/preferences', { method: 'PUT', body: JSON.stringify(prefs) })
      setSync('saved')
    } catch {
      setSync('error')
    }
  }, 500)
}

export function setPrefs(patch: Partial<Prefs>) {
  commit({ ...prefs, ...patch })
  scheduleSave()
}

export const resetPrefs = () => setPrefs(DEFAULTS)

const sameAsDefaults = (p: Prefs) => JSON.stringify(p) === JSON.stringify(DEFAULTS)

/** After login: use the settings saved on the user's account. */
export async function loadPrefsFromServer() {
  try {
    const { preferences } = await api<{ preferences: Prefs | null }>('/api/settings/preferences')
    if (preferences) {
      commit({ ...DEFAULTS, ...preferences })
      setSync('saved')
    } else if (!sameAsDefaults(prefs)) {
      scheduleSave() // first time: store what this browser already had
    }
  } catch {
    /* offline or server down: keep local settings */
  }
}

/** On logout: forget this browser's copy so the next user starts clean. */
export function clearLocalPrefs() {
  clearTimeout(timer)
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  sync = 'idle'
  commit(DEFAULTS)
}

export function useSyncState() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => sync,
  )
}

export function usePrefs() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => prefs,
  )
}

// apply once at startup (before first render) and follow the OS when mode is "system"
applyPrefs(prefs)
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => prefs.mode === 'system' && applyPrefs(prefs))
