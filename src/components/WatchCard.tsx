import { useState, type ReactNode } from 'react'
import {
  Tent,
  MapPin,
  Map,
  RefreshCw,
  Trash2,
  Pause,
  Play,
  ExternalLink,
  Zap,
  CircleCheck,
  CircleSlash,
  TriangleAlert,
  Clock,
  Pencil,
  Copy,
  Plus,
  X,
  Check,
  Accessibility,
  ChevronRight,
  Loader2,
  Clock3,
} from 'lucide-react'
import {
  api,
  formatDateRange,
  formatSchedule,
  frequencyToMinutes,
  localTimeToUtcHHMM,
  minutesToFrequency,
  nightsBetween,
  utcHHMMToLocalTime,
  type DateRange,
  type FrequencyUnit,
  type Watch,
} from '../lib/api'
import { useSitePicker } from '../lib/useSitePicker'
import { SitePickerFields } from './SitePickerFields'
import { ShareButton } from './ShareButton'

type Props = {
  watch: Watch
  onChange: (w: Watch) => void
  onRemove: (id: number) => void
  onCloned: (w: Watch) => void
}

function bookingUrl(w: Watch) {
  return `https://www.reservecalifornia.com/park/${w.placeId}/${w.facilityId}`
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'not yet checked'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

function fmtNight(d: string) {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  })
}

export function WatchCard({ watch, onChange, onRemove, onCloned }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [polling, setPolling] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [ranges, setRanges] = useState<DateRange[]>(watch.dateRanges)
  const [minNights, setMinNights] = useState(watch.minNights)
  const [siteFilter, setSiteFilter] = useState(watch.siteFilter ?? '')
  const [adaOnly, setAdaOnly] = useState(watch.adaOnly)
  const initialFreq = minutesToFrequency(watch.checkFrequencyMinutes)
  const [freqValue, setFreqValue] = useState(initialFreq.value)
  const [freqUnit, setFreqUnit] = useState<FrequencyUnit>(initialFreq.unit)
  const [scheduleMode, setScheduleMode] = useState(watch.scheduleMode)
  const [dailyLocalTime, setDailyLocalTime] = useState(
    watch.dailyCheckTime ? utcHHMMToLocalTime(watch.dailyCheckTime) : '08:00',
  )

  const [cloning, setCloning] = useState(false)
  const [cloneSaving, setCloneSaving] = useState(false)
  const [cloneError, setCloneError] = useState<string | null>(null)
  const clonePicker = useSitePicker(watch.dateRanges[0].startDate)

  const available = watch.availableCount > 0
  const url = bookingUrl(watch)

  async function poll() {
    setPolling(true)
    try {
      onChange(await api.pollNow(watch.id))
    } catch {
      /* surfaced via lastResult on next render */
    } finally {
      setPolling(false)
    }
  }

  async function toggleActive() {
    setBusy(true)
    try {
      onChange(await api.patchWatch(watch.id, { active: !watch.active }))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await api.deleteWatch(watch.id)
      onRemove(watch.id)
    } finally {
      setBusy(false)
    }
  }

  function startEdit() {
    setRanges(watch.dateRanges)
    setMinNights(watch.minNights)
    setSiteFilter(watch.siteFilter ?? '')
    setAdaOnly(watch.adaOnly)
    const freq = minutesToFrequency(watch.checkFrequencyMinutes)
    setFreqValue(freq.value)
    setFreqUnit(freq.unit)
    setScheduleMode(watch.scheduleMode)
    setDailyLocalTime(watch.dailyCheckTime ? utcHHMMToLocalTime(watch.dailyCheckTime) : '08:00')
    setEditError(null)
    setCloning(false)
    setEditing(true)
  }

  function startClone() {
    clonePicker.reset()
    setCloneError(null)
    setEditing(false)
    setCloning(true)
  }

  function updateRange(index: number, patch: Partial<DateRange>) {
    setRanges((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function addRange() {
    setRanges((rs) => [...rs, { startDate: rs[0].startDate, endDate: rs[0].endDate }])
  }

  function removeRange(index: number) {
    setRanges((rs) => rs.filter((_, i) => i !== index))
  }

  async function saveEdit() {
    const badRange = ranges.find((r) => r.endDate <= r.startDate)
    if (badRange) {
      setEditError('Check-out must be after check-in for every date range.')
      return
    }
    setEditError(null)
    setSaving(true)
    try {
      const maxWindow = Math.max(...ranges.map((r) => nightsBetween(r.startDate, r.endDate)))
      onChange(
        await api.patchWatch(watch.id, {
          dateRanges: ranges,
          minNights: Math.min(minNights, maxWindow),
          siteFilter: siteFilter.trim() || null,
          adaOnly,
          scheduleMode,
          ...(scheduleMode === 'daily'
            ? { dailyCheckTime: localTimeToUtcHHMM(dailyLocalTime) }
            : { checkFrequencyMinutes: frequencyToMinutes(freqValue, freqUnit) }),
        }),
      )
      setEditing(false)
    } catch (e) {
      setEditError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function saveClone() {
    const { park, facility } = clonePicker
    if (!park || !facility) {
      setCloneError('Pick a park and campground to clone into.')
      return
    }
    setCloneError(null)
    setCloneSaving(true)
    try {
      const created = await api.createWatch({
        parkName: park.name,
        facilityName: facility.name,
        placeId: park.placeId,
        facilityId: facility.facilityId,
        parkUrl: clonePicker.parkUrl,
        dateRanges: watch.dateRanges,
        minNights: watch.minNights,
        siteFilter: watch.siteFilter,
        adaOnly: watch.adaOnly,
        autoBook: watch.autoBook,
        scheduleMode: watch.scheduleMode,
        checkFrequencyMinutes: watch.checkFrequencyMinutes,
        ...(watch.dailyCheckTime ? { dailyCheckTime: watch.dailyCheckTime } : {}),
      })
      onCloned(created)
      setCloning(false)
    } catch (e) {
      setCloneError((e as Error).message)
    } finally {
      setCloneSaving(false)
    }
  }

  return (
    <article
      className={`rise relative overflow-hidden rounded-3xl border bg-paper/85 shadow-[0_16px_40px_-28px_rgba(29,42,36,0.55)] backdrop-blur transition ${
        available
          ? 'border-ocean/40 ring-1 ring-ocean/20'
          : 'border-pine/10'
      } ${!watch.active ? 'opacity-70' : ''}`}
    >
      {/* compact, always-visible row — collapsed by default */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-sand-deep/20 sm:px-6"
      >
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-pine-soft transition-transform duration-200 ${
            expanded ? 'rotate-90' : ''
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h3 className="truncate font-display text-base font-bold leading-tight text-pine sm:text-lg">
              {watch.facilityName}
            </h3>
            {watch.autoBook && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-sunset-soft/25 px-2 py-0.5 text-[10px] font-semibold text-clay">
                <Zap className="h-3 w-3" /> quick-book
              </span>
            )}
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-pine-soft sm:text-sm">
            <MapPin className="h-3 w-3 shrink-0 text-sunset" /> {watch.parkName}
          </p>
        </div>
        <div className="hidden shrink-0 text-xs text-pine-soft sm:block">
          {formatDateRange(watch.dateRanges[0].startDate, watch.dateRanges[0].endDate)}
          {watch.dateRanges.length > 1 && ` +${watch.dateRanges.length - 1}`}
        </div>
        {available && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-ocean/10 px-2.5 py-1 text-[11px] font-bold text-ocean-deep">
            <span className="beacon inline-block h-1.5 w-1.5 rounded-full bg-ocean" />
            {watch.availableCount} open
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-pine/10">
          {/* status ribbon */}
          <div
            className={`flex items-center gap-2 px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] ${
              available
                ? 'bg-ocean text-paper'
                : watch.lastResult === 'error'
                  ? 'bg-clay/15 text-clay'
                  : 'bg-sand-deep/70 text-pine-soft'
            }`}
          >
            {available ? (
              <>
                <span className="beacon inline-block h-2 w-2 rounded-full bg-sunset-soft" />
                {watch.availableCount} site{watch.availableCount > 1 ? 's' : ''} open
              </>
            ) : watch.lastResult === 'error' ? (
              <>
                <TriangleAlert className="h-3.5 w-3.5" /> check failed — retrying
              </>
            ) : !watch.active ? (
              <>
                <Pause className="h-3.5 w-3.5" /> paused
              </>
            ) : (
              <>
                <CircleSlash className="h-3.5 w-3.5" /> no availability yet
              </>
            )}
          </div>

          <div className="px-6 py-5">
            {cloning ? (
              <div className="space-y-3 rounded-2xl border border-dashed border-ocean/30 bg-ocean/5 p-4">
                <p className="text-xs font-semibold text-pine-soft">
                  Clone this tracker's settings to a different campground.
                </p>
                <SitePickerFields picker={clonePicker} />
                {cloneError && (
                  <p className="rounded-lg bg-clay/10 px-3 py-2 text-xs font-medium text-clay">
                    {cloneError}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={saveClone}
                    disabled={cloneSaving || !clonePicker.facility}
                    className="flex items-center gap-1.5 rounded-lg bg-sunset px-4 py-2 text-sm font-bold text-paper shadow transition hover:bg-clay disabled:opacity-60"
                  >
                    {cloneSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Clone tracker
                  </button>
                  <button
                    onClick={() => setCloning(false)}
                    disabled={cloneSaving}
                    className="rounded-lg border border-pine/12 px-4 py-2 text-sm font-semibold text-pine-soft transition hover:border-pine/25"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : editing ? (
              <div className="mt-4 space-y-3 rounded-2xl border border-dashed border-ocean/30 bg-ocean/5 p-4">
                <div className="space-y-2">
                  {ranges.map((r, i) => (
                    <div key={i} className="flex items-end gap-2">
                      <div className="grid flex-1 gap-2 sm:grid-cols-2">
                        <input
                          type="date"
                          value={r.startDate}
                          onChange={(e) => updateRange(i, { startDate: e.target.value })}
                          className="w-full rounded-lg border border-pine/15 bg-white px-3 py-2 text-sm text-pine outline-none focus:border-ocean"
                        />
                        <input
                          type="date"
                          value={r.endDate}
                          onChange={(e) => updateRange(i, { endDate: e.target.value })}
                          className="w-full rounded-lg border border-pine/15 bg-white px-3 py-2 text-sm text-pine outline-none focus:border-ocean"
                        />
                      </div>
                      {ranges.length > 1 && (
                        <button
                          onClick={() => removeRange(i)}
                          title="Remove this date range"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-pine/12 text-pine-soft transition hover:border-clay/40 hover:text-clay"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addRange}
                    className="flex items-center gap-1.5 text-xs font-semibold text-ocean-deep hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add another date range
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs">
                    <span className="mb-1 block font-semibold text-pine-soft">Min nights</span>
                    <input
                      type="number"
                      min={1}
                      value={minNights}
                      onChange={(e) => setMinNights(Math.max(1, Number(e.target.value)))}
                      className="w-full rounded-lg border border-pine/15 bg-white px-3 py-2 text-sm text-pine outline-none focus:border-ocean"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block font-semibold text-pine-soft">Site filter</span>
                    <input
                      value={siteFilter}
                      onChange={(e) => setSiteFilter(e.target.value)}
                      placeholder="e.g. “walk-in”, “#12”"
                      className="w-full rounded-lg border border-pine/15 bg-white px-3 py-2 text-sm text-pine outline-none focus:border-ocean"
                    />
                  </label>
                </div>

                <div className="text-xs">
                  <span className="mb-1 flex items-center gap-1.5 font-semibold text-pine-soft">
                    <Clock3 className="h-3.5 w-3.5" /> Check frequency
                  </span>
                  <div className="mb-2 flex rounded-lg border border-pine/15 bg-white p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setScheduleMode('interval')}
                      className={`flex-1 rounded-md px-2.5 py-1.5 transition ${
                        scheduleMode === 'interval' ? 'bg-ocean text-paper' : 'text-pine-soft hover:text-pine'
                      }`}
                    >
                      Interval
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleMode('daily')}
                      className={`flex-1 rounded-md px-2.5 py-1.5 transition ${
                        scheduleMode === 'daily' ? 'bg-ocean text-paper' : 'text-pine-soft hover:text-pine'
                      }`}
                    >
                      Daily at a time
                    </button>
                  </div>
                  {scheduleMode === 'interval' ? (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        value={freqValue}
                        onChange={(e) => setFreqValue(Math.max(1, Number(e.target.value)))}
                        className="w-full rounded-lg border border-pine/15 bg-white px-3 py-2 text-sm text-pine outline-none focus:border-ocean"
                      />
                      <select
                        value={freqUnit}
                        onChange={(e) => setFreqUnit(e.target.value as FrequencyUnit)}
                        className="rounded-lg border border-pine/15 bg-white px-3 py-2 text-sm text-pine outline-none focus:border-ocean"
                      >
                        <option value="minutes">minutes</option>
                        <option value="hours">hours</option>
                        <option value="days">days</option>
                      </select>
                    </div>
                  ) : (
                    <input
                      type="time"
                      value={dailyLocalTime}
                      onChange={(e) => setDailyLocalTime(e.target.value)}
                      className="w-full rounded-lg border border-pine/15 bg-white px-3 py-2 text-sm text-pine outline-none focus:border-ocean"
                    />
                  )}
                </div>

                <button
                  onClick={() => setAdaOnly((v) => !v)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    adaOnly
                      ? 'border-ocean bg-ocean/10 text-ocean-deep'
                      : 'border-pine/12 bg-white text-pine-soft hover:border-ocean/40'
                  }`}
                >
                  <Accessibility className="h-3.5 w-3.5" /> ADA sites only
                </button>

                {editError && (
                  <p className="rounded-lg bg-clay/10 px-3 py-2 text-xs font-medium text-clay">
                    {editError}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-lg bg-sunset px-4 py-2 text-sm font-bold text-paper shadow transition hover:bg-clay disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" /> Save
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className="rounded-lg border border-pine/12 px-4 py-2 text-sm font-semibold text-pine-soft transition hover:border-pine/25"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-pine-soft">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Tent className="h-4 w-4 shrink-0 text-ocean" />
                  {watch.dateRanges.map((r, i) => (
                    <span key={i} className="flex items-center gap-2">
                      {i > 0 && <span className="text-pine/30">+</span>}
                      {formatDateRange(r.startDate, r.endDate)}
                    </span>
                  ))}
                </span>
                <span className="text-pine/30">•</span>
                <span>
                  {watch.minNights} night{watch.minNights > 1 ? 's' : ''} min
                </span>
                {watch.siteFilter && (
                  <>
                    <span className="text-pine/30">•</span>
                    <span>“{watch.siteFilter}”</span>
                  </>
                )}
                {watch.adaOnly && (
                  <>
                    <span className="text-pine/30">•</span>
                    <span>ADA only</span>
                  </>
                )}
                <span className="text-pine/30">•</span>
                <span className="flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" /> {formatSchedule(watch)}
                </span>
                {watch.parkUrl && (
                  <>
                    <span className="text-pine/30">•</span>
                    <a
                      href={watch.parkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 font-semibold text-ocean-deep hover:underline"
                    >
                      <Map className="h-3.5 w-3.5" /> Park info & maps
                    </a>
                  </>
                )}
              </div>
            )}

            {/* open units */}
            {available && (
              <div className="mt-4 rounded-2xl border border-dashed border-ocean/30 bg-ocean/5 p-4">
                <ul className="space-y-1.5">
                  {watch.currentAvailability.slice(0, 5).map((u) => (
                    <li
                      key={u.unitId}
                      className="flex flex-wrap items-baseline gap-x-2 text-sm"
                    >
                      <CircleCheck className="h-4 w-4 shrink-0 text-ocean" />
                      <span className="font-semibold text-pine">{u.unitName}</span>
                      <span className="text-pine-soft">
                        {u.dates.slice(0, 6).map(fmtNight).join(', ')}
                        {u.dates.length > 6 ? '…' : ''}
                      </span>
                    </li>
                  ))}
                  {watch.currentAvailability.length > 5 && (
                    <li className="pl-6 text-xs text-pine-soft">
                      +{watch.currentAvailability.length - 5} more site(s)
                    </li>
                  )}
                </ul>
                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-sunset px-4 py-2 text-sm font-bold text-paper shadow transition hover:bg-clay"
                  >
                    <Zap className="h-4 w-4" /> Book now on ReserveCalifornia
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <ShareButton
                    url={url}
                    title={`${watch.facilityName} — ${watch.parkName}`}
                    text={`${watch.availableCount} site${watch.availableCount > 1 ? 's' : ''} open at ${watch.facilityName}, ${watch.parkName}`}
                  />
                </div>
              </div>
            )}

            {/* footer actions */}
            <div className="mt-5 flex items-center justify-between border-t border-pine/10 pt-4">
              <span className="flex items-center gap-1.5 text-xs text-pine-soft">
                <Clock className="h-3.5 w-3.5" /> {relativeTime(watch.lastCheckedAt)}
              </span>
              {!editing && !cloning && (
                <div className="flex items-center gap-1">
                  <IconButton onClick={startEdit} title="Edit tracker">
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton onClick={startClone} title="Clone to a different site">
                    <Copy className="h-4 w-4" />
                  </IconButton>
                  <IconButton onClick={poll} busy={polling} title="Check now">
                    <RefreshCw className={`h-4 w-4 ${polling ? 'animate-spin' : ''}`} />
                  </IconButton>
                  <IconButton onClick={toggleActive} busy={busy} title={watch.active ? 'Pause' : 'Resume'}>
                    {watch.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </IconButton>
                  <IconButton onClick={remove} busy={busy} title="Delete" danger>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

function IconButton({
  children,
  onClick,
  busy,
  title,
  danger,
}: {
  children: ReactNode
  onClick: () => void
  busy?: boolean
  title: string
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={title}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border border-transparent transition disabled:opacity-50 ${
        danger
          ? 'text-clay hover:bg-clay/10'
          : 'text-pine-soft hover:border-pine/10 hover:bg-sand-deep/50'
      }`}
    >
      {children}
    </button>
  )
}
