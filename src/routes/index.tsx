import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { Waves, LogOut, Tent, ShieldCheck } from 'lucide-react'
import { AddWatchForm } from '../components/AddWatchForm'
import { WatchCard } from '../components/WatchCard'
import { NotificationsFeed } from '../components/NotificationsFeed'
import { FrequencyControl } from '../components/FrequencyControl'
import { AuthGate } from '../components/AuthGate'
import { api, type AuthUser, type MatchRow, type Watch } from '../lib/api'

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .finally(() => setReady(true))
  }, [])

  async function signOut() {
    await api.logout()
    setUser(null)
  }

  if (!ready) return null

  return (
    <div className="relative z-10 min-h-screen">
      {user ? (
        <Dashboard user={user} onSignOut={signOut} />
      ) : (
        <AuthGate onAuthenticated={setUser} />
      )}
      <Footer />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Dashboard({
  user,
  onSignOut,
}: {
  user: AuthUser
  onSignOut: () => void
}) {
  const [watches, setWatches] = useState<Watch[]>([])
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [w, m] = await Promise.all([api.listWatches(), api.listMatches()])
      setWatches(w)
      setMatches(m)
    } catch {
      /* transient; next interval retries */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, [refresh])

  const openCount = watches.filter((w) => w.availableCount > 0).length

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-ocean-deep">
          <Waves className="h-6 w-6" />
          <span className="font-display text-sm font-bold uppercase tracking-[0.28em]">
            SurfCampTrackerCali
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-pine-soft">
          <span className="hidden sm:inline">{user.email}</span>
          {user.isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 rounded-lg border border-pine/12 bg-paper/70 px-3 py-1.5 font-medium transition hover:border-pine/25"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> admin
            </Link>
          )}
          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 rounded-lg border border-pine/12 bg-paper/70 px-3 py-1.5 font-medium transition hover:border-pine/25"
          >
            <LogOut className="h-3.5 w-3.5" /> log out
          </button>
        </div>
      </header>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-black text-pine sm:text-5xl">
          Your trackers
        </h1>
        <StatStrip watches={watches.length} open={openCount} alerts={matches.length} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-6">
          <AddWatchForm onCreated={refresh} />

          {watches.length > 0 && (
            <FrequencyControl
              watches={watches}
              onAppliedToAll={(updated) => setWatches(updated)}
            />
          )}

          {loading ? (
            <div className="space-y-4">
              {[0, 1].map((i) => (
                <div key={i} className="skeleton h-40 rounded-3xl" />
              ))}
            </div>
          ) : watches.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-pine/20 bg-paper/60 px-6 py-14 text-center">
              <Tent className="mx-auto h-9 w-9 text-ocean/50" />
              <p className="mt-3 font-display text-lg font-bold text-pine">
                No trackers yet
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-pine-soft">
                Search a park above and pick your dates to set up your first
                availability watch.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {watches.map((w) => (
                <WatchCard
                  key={w.id}
                  watch={w}
                  onChange={(updated) =>
                    setWatches((prev) =>
                      prev.map((x) => (x.id === updated.id ? updated : x)),
                    )
                  }
                  onRemove={(id) => {
                    setWatches((prev) => prev.filter((x) => x.id !== id))
                    refresh()
                  }}
                  onCloned={(created) =>
                    setWatches((prev) => [created, ...prev])
                  }
                />
              ))}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-8 lg:self-start">
          <NotificationsFeed matches={matches} />
        </div>
      </div>
    </main>
  )
}

function StatStrip({
  watches,
  open,
  alerts,
}: {
  watches: number
  open: number
  alerts: number
}) {
  const items = [
    { label: 'tracking', value: watches },
    { label: 'open now', value: open, accent: open > 0 },
    { label: 'alerts', value: alerts },
  ]
  return (
    <div className="flex divide-x divide-pine/10 overflow-hidden rounded-2xl border border-pine/10 bg-paper/70">
      {items.map((it) => (
        <div key={it.label} className="px-5 py-2.5 text-center">
          <div
            className={`font-display text-2xl font-black ${
              it.accent ? 'text-ocean' : 'text-pine'
            }`}
          >
            {it.value}
          </div>
          <div className="text-[11px] uppercase tracking-wider text-pine-soft">
            {it.label}
          </div>
        </div>
      ))}
    </div>
  )
}

function Footer() {
  return (
    <footer className="relative z-10 mx-auto max-w-6xl px-5 pb-10 pt-16">
      <div className="border-t border-pine/10 pt-6 text-xs leading-relaxed text-pine-soft">
        <p className="font-display font-bold text-pine">SurfCampTrackerCali</p>
        <p className="mt-1 max-w-2xl">
          An independent availability tracker. Not affiliated with or endorsed
          by California State Parks or ReserveCalifornia. Availability data comes
          from the public ReserveCalifornia API and all bookings and payment
          happen on the official reservecalifornia.com site.
        </p>
      </div>
    </footer>
  )
}
