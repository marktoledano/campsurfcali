import { useState, type ReactNode } from 'react'
import {
  Tent,
  MapPin,
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
} from 'lucide-react'
import { api, formatDateRange, type Watch } from '../lib/api'

type Props = {
  watch: Watch
  onChange: (w: Watch) => void
  onRemove: (id: number) => void
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

export function WatchCard({ watch, onChange, onRemove }: Props) {
  const [polling, setPolling] = useState(false)
  const [busy, setBusy] = useState(false)

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

  return (
    <article
      className={`rise relative overflow-hidden rounded-3xl border bg-paper/85 shadow-[0_16px_40px_-28px_rgba(29,42,36,0.55)] backdrop-blur transition ${
        available
          ? 'border-ocean/40 ring-1 ring-ocean/20'
          : 'border-pine/10'
      } ${!watch.active ? 'opacity-70' : ''}`}
    >
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold leading-tight text-pine">
              {watch.facilityName}
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-pine-soft">
              <MapPin className="h-3.5 w-3.5 text-sunset" /> {watch.parkName}
            </p>
          </div>
          {watch.autoBook && (
            <span className="flex items-center gap-1 rounded-full bg-sunset-soft/25 px-2.5 py-1 text-[11px] font-semibold text-clay">
              <Zap className="h-3 w-3" /> quick-book
            </span>
          )}
        </div>

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
        </div>

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
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-sunset px-4 py-2 text-sm font-bold text-paper shadow transition hover:bg-clay"
            >
              <Zap className="h-4 w-4" /> Book now on ReserveCalifornia
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        {/* footer actions */}
        <div className="mt-5 flex items-center justify-between border-t border-pine/10 pt-4">
          <span className="flex items-center gap-1.5 text-xs text-pine-soft">
            <Clock className="h-3.5 w-3.5" /> {relativeTime(watch.lastCheckedAt)}
          </span>
          <div className="flex items-center gap-1">
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
        </div>
      </div>
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
