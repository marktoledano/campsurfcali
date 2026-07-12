import { useState, type ReactNode } from 'react'
import {
  Calendar,
  Accessibility,
  Zap,
  Plus,
  Loader2,
  X,
  Clock3,
} from 'lucide-react'
import {
  api,
  frequencyToMinutes,
  nightsBetween,
  type DateRange,
  type FrequencyUnit,
  type NewWatchInput,
} from '../lib/api'
import { useSitePicker } from '../lib/useSitePicker'
import { SitePickerFields } from './SitePickerFields'

type Props = {
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
function defaultRange(): DateRange {
  return { startDate: tomorrow(), endDate: plusDays(tomorrow(), 2) }
}

export function AddWatchForm({ onCreated }: Props) {
  const [ranges, setRanges] = useState<DateRange[]>([defaultRange()])
  const picker = useSitePicker(ranges[0].startDate)
  const { park, facility } = picker

  const [minNights, setMinNights] = useState(1)
  const [siteFilter, setSiteFilter] = useState('')
  const [adaOnly, setAdaOnly] = useState(false)
  const [autoBook, setAutoBook] = useState(false)
  const [freqValue, setFreqValue] = useState(5)
  const [freqUnit, setFreqUnit] = useState<FrequencyUnit>('minutes')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateRange(index: number, patch: Partial<DateRange>) {
    setRanges((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function addRange() {
    setRanges((rs) => [...rs, defaultRange()])
  }

  function removeRange(index: number) {
    setRanges((rs) => rs.filter((_, i) => i !== index))
  }

  async function submit() {
    if (!park || !facility) return
    setError(null)
    const badRange = ranges.find((r) => r.endDate <= r.startDate)
    if (badRange) {
      setError('Check-out must be after check-in for every date range.')
      return
    }
    setSubmitting(true)
    const maxWindow = Math.max(...ranges.map((r) => nightsBetween(r.startDate, r.endDate)))
    const input: NewWatchInput = {
      parkName: park.name,
      facilityName: facility.name,
      placeId: park.placeId,
      facilityId: facility.facilityId,
      dateRanges: ranges,
      minNights: Math.min(minNights, maxWindow),
      siteFilter: siteFilter.trim() || null,
      adaOnly,
      autoBook,
      checkFrequencyMinutes: frequencyToMinutes(freqValue, freqUnit),
    }
    try {
      await api.createWatch(input)
      picker.reset()
      setRanges([defaultRange()])
      setMinNights(1)
      setSiteFilter('')
      setAdaOnly(false)
      setAutoBook(false)
      setFreqValue(5)
      setFreqUnit('minutes')
      onCreated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const maxWindow = Math.max(...ranges.map((r) => nightsBetween(r.startDate, r.endDate)))

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
        {/* Steps 1 & 2 — park + facility search */}
        <SitePickerFields picker={picker} />
        {picker.error && !facility && (
          <p className="rounded-xl bg-clay/10 px-4 py-3 text-sm font-medium text-clay">
            {picker.error}
          </p>
        )}

        {/* Step 3 — dates + options */}
        {facility && (
          <div className="rise space-y-5">
            <div className="space-y-3">
              {ranges.map((range, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="grid flex-1 gap-4 sm:grid-cols-2">
                    <Field
                      label={i === 0 ? 'Check-in' : `Check-in (range ${i + 1})`}
                      icon={<Calendar className="h-4 w-4 text-ocean" />}
                    >
                      <input
                        type="date"
                        value={range.startDate}
                        min={tomorrow()}
                        onChange={(e) => {
                          const patch: Partial<DateRange> = { startDate: e.target.value }
                          if (range.endDate <= e.target.value)
                            patch.endDate = plusDays(e.target.value, 1)
                          updateRange(i, patch)
                        }}
                        className="w-full rounded-xl border border-pine/15 bg-sand/60 px-3 py-2.5 text-pine outline-none focus:border-ocean focus:bg-white"
                      />
                    </Field>
                    <Field
                      label={i === 0 ? 'Check-out' : `Check-out (range ${i + 1})`}
                      icon={<Calendar className="h-4 w-4 text-ocean" />}
                    >
                      <input
                        type="date"
                        value={range.endDate}
                        min={plusDays(range.startDate, 1)}
                        onChange={(e) => updateRange(i, { endDate: e.target.value })}
                        className="w-full rounded-xl border border-pine/15 bg-sand/60 px-3 py-2.5 text-pine outline-none focus:border-ocean focus:bg-white"
                      />
                    </Field>
                  </div>
                  {ranges.length > 1 && (
                    <button
                      onClick={() => removeRange(i)}
                      title="Remove this date range"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-pine/12 text-pine-soft transition hover:border-clay/40 hover:text-clay"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addRange}
                className="flex items-center gap-1.5 text-sm font-semibold text-ocean-deep hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Add another date range
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`Minimum consecutive nights (longest window is ${maxWindow})`}>
                <input
                  type="number"
                  min={1}
                  max={maxWindow}
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

            <Field label="Check frequency" icon={<Clock3 className="h-4 w-4 text-ocean" />}>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={freqValue}
                  onChange={(e) => setFreqValue(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-pine/15 bg-sand/60 px-3 py-2.5 text-pine outline-none focus:border-ocean focus:bg-white"
                />
                <select
                  value={freqUnit}
                  onChange={(e) => setFreqUnit(e.target.value as FrequencyUnit)}
                  className="rounded-xl border border-pine/15 bg-sand/60 px-3 py-2.5 text-pine outline-none focus:border-ocean focus:bg-white"
                >
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                </select>
              </div>
            </Field>

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
