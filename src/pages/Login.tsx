import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { setMe } from '../auth'
import { api } from '../api'

function Illustration() {
  return (
    <div className="relative mx-auto w-full" aria-hidden>
      {/* floating CRM badges */}
      <span className="bob absolute left-[14%] top-[0%] z-10 rounded-full bg-[#141414] px-3 py-1 text-sm sm:px-5 sm:py-2 sm:text-lg font-extrabold text-white">
        Leads
      </span>
      <span className="bob absolute left-[24%] top-[17%] z-10 flex items-center gap-2 rounded-full bg-[#141414] px-3 py-1 text-xs sm:px-4 sm:py-2 sm:text-base font-bold text-white [animation-delay:1s]">
        <span className="h-4 w-4 rounded-full bg-[#f08a3c] sm:h-5 sm:w-5" /> Deals
      </span>
      <svg viewBox="0 0 380 300" className="w-full">
        {/* arrow */}
        <path d="M18 62 L66 44 L52 92 L42 70Z" fill="#fbdc7a" />
        {/* blob */}
        <path d="M70 150 Q60 80 170 78 Q290 72 300 160 Q306 230 200 236 Q80 242 70 150Z" fill="#9a84e6" />
        {/* lamp */}
        <path d="M262 32 H312 Q312 8 287 8 Q262 8 262 32Z" fill="#fbdc7a" />
        <rect x="282" y="34" width="10" height="46" fill="#4b2fa8" />
        {/* chair */}
        <path d="M222 62 Q258 54 268 76 L258 118 L222 118Z" fill="#fbdc7a" />
        <path d="M172 170 Q220 160 262 168 L258 178 Q215 176 172 182Z" fill="#fbdc7a" />
        <rect x="216" y="178" width="6" height="52" fill="#4b2fa8" />
        <path d="M170 255 L219 232 L268 255" stroke="#4b2fa8" strokeWidth="7" fill="none" strokeLinecap="round" />
        <circle cx="170" cy="258" r="7" fill="#4b2fa8" />
        <circle cx="219" cy="268" r="7" fill="#4b2fa8" />
        <circle cx="268" cy="258" r="7" fill="#4b2fa8" />
        {/* desk */}
        <rect x="30" y="120" width="320" height="12" rx="2" fill="#fbdc7a" />
        <rect x="36" y="132" width="308" height="24" fill="#f6eed8" stroke="#a28bec" strokeWidth="1" />
        <line x1="130" y1="132" x2="130" y2="156" stroke="#a28bec" />
        <line x1="250" y1="132" x2="250" y2="156" stroke="#a28bec" />
        <path d="M52 156 L46 280 L56 280 L66 156Z" fill="#f6eed8" />
        <path d="M330 156 L336 280 L326 280 L316 156Z" fill="#f6eed8" />
      </svg>
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (localStorage.getItem('token')) return <Navigate to="/" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Enter your email and password.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const data = await api<{ token: string; user: any }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      localStorage.setItem('token', data.token)
      setMe(data.user)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Cannot reach the server. Is the backend running?')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1240px] flex-col px-5 sm:px-8">
        <header className="py-5 text-2xl font-extrabold tracking-tight">brando.</header>

        <div className="grid flex-1 items-center justify-items-center gap-10 pb-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,420px)] lg:gap-16 lg:pb-0">
          <section className="flex w-full flex-col items-center text-center">
            <div className="w-full max-w-[230px] sm:max-w-[320px] lg:max-w-[400px]">
              <Illustration />
            </div>
            <h1 className="mt-4 text-[clamp(28px,5vw,56px)] sm:mt-6 font-extrabold leading-[1.1] tracking-[-0.03em]">
              Close more deals,
              <span className="mt-1 block"><span className="bg-white px-2">stay organised</span></span>
            </h1>
            <p className="mt-4 text-sm">Built for sales teams everywhere.</p>
          </section>

        <form className="w-full max-w-[420px] rounded-xl bg-white p-6 shadow-xl sm:p-8" onSubmit={onSubmit} noValidate>
          <h2 className="mb-6 text-center text-[28px] font-bold">Log in</h2>

          <div className="fld">
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" autoComplete="username" placeholder="you@company.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="fld mb-1">
            <label htmlFor="password">Password</label>
            <div className="relative">
              <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password"
                placeholder="••••••••" className="pr-11"
                value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {show
                    ? <path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.7M6.6 6.6A17 17 0 0 0 2 12s4 6 10 6c1.5 0 2.9-.4 4.1-1" />
                    : <><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>}
                </svg>
              </button>
            </div>
          </div>
          <div className="mb-3 text-right">
            <a href="#" className="text-xs font-medium text-[#5b3fd0] hover:underline">Forgot password?</a>
          </div>

          {error && <span role="alert" className="mb-3 block text-[13.5px] text-[#d4342a]">{error}</span>}

          <button className="btn-dark" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        </form>
        </div>
      </div>
    </main>
  )
}
