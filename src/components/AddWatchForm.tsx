import { useEffect, useRef, useState } from 'react'
import {
  Search,
  MapPin,
  Tent,
  Calendar,
  Accessibility,
  Zap,
  Plus,
  Loader2,
  ChevronLeft,
} from 'lucide-react'
import {
  api,
  nightsBetween,
  type FacilityResult,
  type NewWatchInput,
  type ParkResult,
} from '../lib/api'

type Props = {
  email: string
  onCreated: () => void
}

function tomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}
function plusDays(from: string, n: number): string {
  const d = new Date(from + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function AddWatchForm({ email, onCreated }: Props) {
  const [query, setQuery] = useState('')
  const [parks, setParks] = useState<ParkResult[]>([])
  const [searching, setSearching] = useState(false)
  const [park, setPark] = useState<ParkResult | null>(null)

  const [facilities, setFacilities] = useState<FacilityResult[]>([])
  const [loadingFacilities, setLoadingFacilities] = useState(false)
  const [facility, setFacility] = useState<FacilityResult | null>(null)

  const [startDate, setStartDate] = useState(tomorrow())
  const [endDate, setEndDate] = useState(plusDays(tomorrow(), 2))
  const [minNights, setMinNights] = useState(1)
  const [siteFilter, setSiteFilter] = useState('')
  const [adaOnly, setAdaOnly] = useState(false)
  const [autoBook, setAutoBook] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Debounced park search.
  useEffect(() => {
    if (park) return
    if (query.trim().length < 2) {
      setParks([])
      return
    }
    setSearching(true)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      try {
        setParks(await api.searchParks(query.trim()))
      } catch {
        setParks([])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => clearTimeout(debounce.current)
  }, [query, park])

  async function pickPark(p: ParkResult) {
    setPark(p)
    setParks([])
    setQuery(p.name)
    setLoadingFacilities(true)
    setError(null)
    try {
      const list = await api.getFacilities(p.placeId, startDate)
      setFacilities(list)
      if (list.length === 0)
        setError('No campgrounds found for this park right now.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingFacilities(false)
    }
  }

  function reset() {
    setPark(null)
    setFacility(null)
    setFacilities([])
    setQuery('')
    setError(null)
  }

  async function submit() {
    if (!park || !facility) return
    setError(null)
    if (endDate <= startDate) {
      setError('Check-out must be after check-in.')
      return
    }
    setSubmitting(true)
    const input: NewWatchInput = {
      email,
      parkName: park.name,
      facilityName: facility.name,
      placeId: park.placeId,
      facilityId: facility.facilityId,
      startDate,
      endDate,
      minNights: Math.min(minNights, nightsBetween(startDate, endDate)),
      siteFilter: siteFilter.trim() || null,
      adaOnly,
      autoBook,
    }
    try {
      await api.createWatch(input)
      reset()
      setStartDate(tomorrow())
      setEndDate(plusDays(tomorrow(), 2))
      setMinNights(1)
      setSiteFilter('')
      setAdaOnly(false)
      setAutoBook(false)
      onCreated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const totalNights = nightsBetween(startDate, endDate)

  return (
    <div className="relative overflow-hidden rounded-3xl border border-pine/10 bg-paper/80 shadow-[0_20px_60px_-30px_rgba(29,42,36,0.5)] backdrop-blur">
      <div className="border-b border-dashed border-pine/15 bg-ocean px-6 py-4 sm:px-8">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sand/80">
          New tracker
        </p>
        <h2 className="font-display text-2xl font-bold text-paper sm:text-3xl">
          Stake out a campground
        </h2>
      </div>

      <div className="space-y-6 px-6 py-7 sm:px-8">
        {/* Step 1 — park search */}
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-pine-soft">
            <MapPin className="h-4 w-4 text-ocean" /> Park or recreation area
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-pine/40" />
            <input
              value={query}
              onChange={(e) => {
                if (park) reset()
                setQuery(e.target.value)
              }}
              placeholder="Try “Big Sur”, “Sonoma Coast”, “Crystal Cove”…"
              className="w-full rounded-xl border border-pine/15 bg-sand/60 py-3 pl-11 pr-10 text-pine outline-none transition focus:border-ocean focus:bg-white focus:ring-4 focus:ring-ocean/10"
            />
            {searching && (
              <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ocean" />
            )}
          </div>

          {parks.length > 0 && (
            <ul className="mt-2 max-h-56 divide-y divide-pine/5 overflow-auto rounded-xl border border-pine/10 bg-white shadow-lg">
              {parks.map((p) => (
                <li key={p.placeId}>
                  <button
                    onClick={() => pickPark(p)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ocean/5"
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-sunset" />
                    <span className="text-sm font-medium text-pine">{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Step 2 — facility */}
        {park && (
          <div className="rise">
            <div className="mb-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-semibold text-pine-soft">
                <Tent className="h-4 w-4 text-ocean" /> Campground
              </label>
              <button
                onClick={reset}
                className="flex items-center gap-1 text-xs font-semibold text-clay hover:underline"
              >
                <ChevronLeft className="h-3 w-3" /> change park
              </button>
            </div>
            {loadingFacilities ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-12 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {facilities.map((f) => {
                  const on = facility?.facilityId === f.facilityId
                  return (
                    <button
                      key={f.facilityId}
                      onClick={() => setFacility(f)}
                      className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                        on
                          ? 'border-ocean bg-ocean text-paper shadow-md'
                          : 'border-pine/12 bg-sand/50 text-pine hover:border-ocean/50 hover:bg-white'
                      }`}
                    >
                      <span className="font-semibold">{f.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 3 — dates + options */}
        {facility && (
          <div className="rise space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Check-in" icon={<Calendar className="h-4 w-4 text-ocean" />}>
                <input
                  type="date"
                  value={startDate}
                  min={tomorrow()}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    if (endDate <= e.target.value)
                      setEndDate(plusDays(e.target.value, 1))
                  }}
                  className="w-full rounded-xl border border-pine/15 bg-sand/60 px-3 py-2.5 text-pine outline-none focus:border-ocean focus:bg-white"
                />
              </Field>
              <Field label="Check-out" icon={<Calendar className="h-4 w-4 text-ocean" />}>
                <input
                  type="date"
                  value={endDate}
                  min={plusDays(startDate, 1)}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-pine/15 bg-sand/60 px-3 py-2.5 text-pine outline-none focus:border-ocean focus:bg-white"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`Minimum consecutive nights (window is ${totalNights})`}>
                <input
                  type="number"
                  min={1}
                  max={totalNights}
                  value={minNights}
                  onChange={(e) => setMinNights(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-pine/15 bg-sand/60 px-3 py-2.5 text-pine outline-none focus:border-ocean focus:bg-white"
                />
              </Field>
              <Field label="Only sites matching (optional)">
                <input
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  placeholder="e.g. “walk-in”, “#12”, “hike”"
                  className="w-full rounded-xl border border-pine/15 bg-sand/60 px-3 py-2.5 text-pine outline-none focus:border-ocean focus:bg-white"
                />
              </Field>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Toggle
                on={adaOnly}
                onClick={() => setAdaOnly((v) => !v)}
                icon={<Accessibility className="h-4 w-4" />}
                label="ADA sites only"
              />
              <Toggle
                on={autoBook}
                onClick={() => setAutoBook((v) => !v)}
                icon={<Zap className="h-4 w-4" />}
                label="Flag for quick-book"
              />
            </div>

            {autoBook && (
              <p className="rounded-xl border border-sunset/30 bg-sunset-soft/15 px-4 py-3 text-xs leading-relaxed text-pine-soft">
                Quick-book alerts surface a one-tap deep link straight to the
                ReserveCalifornia checkout page for the open site. You complete
                payment on the official site — we never store your login.
              </p>
            )}

            {error && (
              <p className="rounded-xl bg-clay/10 px-4 py-3 text-sm font-medium text-clay">
                {error}
              </p>
            )}

            <button
              onClick={submit}
              disabled={submitting}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-sunset px-6 py-3.5 font-display text-base font-bold text-paper shadow-lg transition hover:bg-clay disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Plus className="h-5 w-5 transition group-hover:rotate-90" />
              )}
              Start tracking this campground
            </button>
          </div>
        )}

        {!park && error && (
          <p className="rounded-xl bg-clay/10 px-4 py-3 text-sm font-medium text-clay">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  icon,
  children,
}: {
  label: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-pine-soft">
        {icon}
        {label}
      </label>
      {children}
    </div>
  )
}

function Toggle({
  on,
  onClick,
  icon,
  label,
}: {
  on: boolean
  onClick: () => void
  icon: ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
        on
          ? 'border-ocean bg-ocean/10 text-ocean-deep'
          : 'border-pine/12 bg-sand/50 text-pine-soft hover:border-ocean/40'
      }`}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
          on ? 'border-ocean bg-ocean text-paper' : 'border-pine/25 bg-white'
        }`}
      >
        {on && icon}
      </span>
      {label}
    </button>
  )
}
