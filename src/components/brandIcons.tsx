/* The Facebook and Google logos, used wherever a lead source or connection is shown. */

export function FacebookIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Facebook" className="shrink-0">
      {/* white behind the blue disk, so the "f" cut-out reads as white on any background */}
      <circle cx="12" cy="12" r="11.6" fill="#fff" />
      <path
        fill="#1877F2"
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
    </svg>
  )
}

export function GoogleG({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Google" className="shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

/** The icon for a lead source: "meta" shows the Facebook logo, "google" the Google G. */
export function SourceIcon({ source, size = 24 }: { source: string; size?: number }) {
  if (source === 'meta') return <FacebookIcon size={size} />
  if (source === 'google') {
    // the multicolour G sits on a white disk so it stays readable in dark mode
    return (
      <span className="grid shrink-0 place-items-center rounded-full bg-white ring-1 ring-black/10" style={{ width: size, height: size }}>
        <GoogleG size={Math.round(size * 0.64)} />
      </span>
    )
  }
  if (source === 'manual') {
    return (
      <span className="grid shrink-0 place-items-center rounded-full bg-ink/10 text-ink" style={{ width: size, height: size }} title="Added manually">
        <svg width={Math.round(size * 0.55)} height={Math.round(size * 0.55)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Added manually">
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      </span>
    )
  }
  // any other source: a neutral letter tile
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-ink/10 font-extrabold text-ink" style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {source.charAt(0).toUpperCase()}
    </span>
  )
}
