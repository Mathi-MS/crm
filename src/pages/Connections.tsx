import ConnectionsTab from '../components/settings/ConnectionsTab'

export default function Connections() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 overflow-hidden rounded-2xl bg-sidebar p-6 text-white shadow-sm sm:p-8">
        <div className="relative">
          <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-brand/40 blur-3xl" aria-hidden />
          <h2 className="relative text-2xl font-extrabold tracking-tight sm:text-3xl">Connections</h2>
          <p className="relative mt-1 max-w-md text-sm text-white/60">Connect the accounts your leads come from.</p>
        </div>
      </div>
      <ConnectionsTab />
    </div>
  )
}
