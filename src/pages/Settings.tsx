import AppearanceTab from '../components/settings/AppearanceTab'

export default function Settings() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 overflow-hidden rounded-2xl bg-sidebar p-6 text-white shadow-sm sm:p-8">
        <div className="relative">
          <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-brand/40 blur-3xl" aria-hidden />
          <h2 className="relative text-2xl font-extrabold tracking-tight sm:text-3xl">Make it yours</h2>
          <p className="relative mt-1 max-w-md text-sm text-white/60">Pick your theme, colors and font. Your choices are saved to your account.</p>
        </div>
      </div>
      <AppearanceTab />
    </div>
  )
}
