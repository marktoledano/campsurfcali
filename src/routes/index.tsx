import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  Waves,
  Compass,
  BellRing,
  CalendarClock,
  ArrowRight,
  LogOut,
  Tent,
} from 'lucide-react'
import { AddWatchForm } from '../components/AddWatchForm'
import { WatchCard } from '../components/WatchCard'
import { NotificationsFeed } from '../components/NotificationsFeed'
import { api, type MatchRow, type Watch } from '../lib/api'

export const Route = createFileRoute('/')({
  component: App,
})

const EMAIL_KEY = 'sctc:email'

function App() {
  const [email, setEmail] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setEmail(localStorage.getItem(EMAIL_KEY))
    setReady(true)
  }, [])

  function signIn(value: string) {
    const clean = value.trim().toLowerCase()
    localStorage.setItem(EMAIL_KEY, clean)
    setEmail(clean)
  }
  function signOut() {
    localStorage.removeItem(EMAIL_KEY)
    setEmail(null)
  }

  if (!ready) return null

  return (
    <div className="relative z-10 min-h-screen">
      {email ? (
        <Dashboard email={email} onSignOut={signOut} />
      ) : (
        <Landing onStart={signIn} />
      )}
      <Footer />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Landing({ onStart }: { onStart: (email: string) => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim())) {
      setError('Enter a valid email so we know where to send alerts.')
      return
    }
    onStart(value)
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-16 sm:py-24">
      <div className="flex items-center gap-2 text-ocean-deep">
        <Waves className="h-6 w-6" />
        <span className="font-display text-sm font-bold uppercase tracking-[0.3em]">
          SurfCampTrackerCali
        </span>
      </div>

      <h1 className="mt-10 max-w-3xl font-display text-5xl font-black leading-[0.98] text-pine sm:text-7xl">
        The California coast is{' '}
        <span className="text-ocean">booked solid.</span> We watch for the{' '}
        <span className="text-sunset">cancellation.</span>
      </h1>

      <p className="mt-6 max-w-xl text-lg leading-relaxed text-pine-soft">
        Point us at any ReserveCalifornia campground and your dates. We poll the
        official availability grid every few minutes and ping you the instant a
        site frees up — with a one-tap link straight to checkout.
      </p>

      <form
        onSubmit={submit}
        className="mt-10 flex max-w-md flex-col gap-3 sm:flex-row"
      >
        <input
          type="email"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError('')
          }}
          placeholder="you@example.com"
          className="flex-1 rounded-xl border border-pine/15 bg-paper px-4 py-3.5 text-pine shadow-sm outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10"
        />
        <button
          type="submit"
          className="group flex items-center justify-center gap-2 rounded-xl bg-pine px-6 py-3.5 font-display font-bold text-sand transition hover:bg-ocean-deep"
        >
          Start tracking
          <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
        </button>
      </form>
      {error && <p className="mt-2 text-sm font-medium text-clay">{error}</p>}

      <div className="mt-20 grid gap-6 sm:grid-cols-3">
        <Feature
          icon={<Compass className="h-5 w-5" />}
          title="Every state park"
          body="Search all ReserveCalifornia parks and campgrounds — from Big Sur to the Sierra."
        />
        <Feature
          icon={<CalendarClock className="h-5 w-5" />}
          title="Checked every 5 min"
          body="A scheduled poller sweeps your dates around the clock so you don't have to."
        />
        <Feature
          icon={<BellRing className="h-5 w-5" />}
          title="Alert + quick-book"
          body="Get an in-app alert (and email) with a direct link to grab the open site."
        />
      </div>
    </main>
  )
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: ReactNode
  title: string
  body: string
}) {
  return (
    <div className="rounded-2xl border border-pine/10 bg-paper/70 p-6 backdrop-blur">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ocean/10 text-ocean">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-pine">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-pine-soft">{body}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Dashboard({
  email,
  onSignOut,
}: {
  email: string
  onSignOut: () => void
}) {
  const [watches, setWatches] = useState<Watch[]>([])
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [w, m] = await Promise.all([
        api.listWatches(email),
        api.listMatches(email),
      ])
      setWatches(w)
      setMatches(m)
    } catch {
      /* transient; next interval retries */
    } finally {
      setLoading(false)
    }
  }, [email])

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
          <span className="hidden sm:inline">{email}</span>
          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 rounded-lg border border-pine/12 bg-paper/70 px-3 py-1.5 font-medium transition hover:border-pine/25"
          >
            <LogOut className="h-3.5 w-3.5" /> switch
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
          <AddWatchForm email={email} onCreated={refresh} />

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
