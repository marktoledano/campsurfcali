import { Bell, ExternalLink, Mail, MonitorSmartphone, Ticket } from 'lucide-react'
import type { MatchRow } from '../lib/api'
import { ShareButton } from './ShareButton'

function fmtWhen(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function fmtNight(d: string) {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  })
}

export function NotificationsFeed({ matches }: { matches: MatchRow[] }) {
  return (
    <div className="rounded-3xl border border-pine/10 bg-pine text-sand shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)]">
      <div className="flex items-center gap-2 border-b border-sand/10 px-6 py-4">
        <Bell className="h-4 w-4 text-sunset-soft" />
        <h2 className="font-display text-lg font-bold">Alert log</h2>
        {matches.length > 0 && (
          <span className="ml-auto rounded-full bg-sand/10 px-2.5 py-0.5 text-xs font-semibold text-sand/80">
            {matches.length}
          </span>
        )}
      </div>

      {matches.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <Ticket className="mx-auto h-8 w-8 text-sand/30" />
          <p className="mt-3 text-sm text-sand/60">
            No alerts yet. When a tracked site opens up, it lands here — and in
            your inbox if email delivery is configured.
          </p>
        </div>
      ) : (
        <ul className="max-h-[560px] divide-y divide-sand/10 overflow-auto">
          {matches.map((m) => (
            <li key={m.id} className="px-6 py-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-sm font-bold text-paper">
                  {m.facilityName}
                </span>
                <span className="shrink-0 text-[11px] text-sand/50">
                  {fmtWhen(m.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-sand/60">{m.parkName}</p>
              <p className="mt-2 text-sm text-sand/90">
                <span className="font-semibold text-sunset-soft">
                  {m.unitName}
                </span>{' '}
                — {m.dates.slice(0, 6).map(fmtNight).join(', ')}
                {m.dates.length > 6 ? '…' : ''}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <a
                  href={m.bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-ocean-deep"
                >
                  <span className="rounded-md bg-sunset-soft px-2 py-1 text-pine">
                    Book <ExternalLink className="ml-0.5 inline h-3 w-3" />
                  </span>
                </a>
                <ShareButton
                  url={m.bookingUrl}
                  title={`${m.facilityName} — ${m.parkName}`}
                  text={`${m.unitName} — ${m.dates.slice(0, 6).map(fmtNight).join(', ')} at ${m.facilityName}, ${m.parkName}`}
                  dark
                />
                <span className="ml-1 inline-flex items-center gap-1 text-[11px] text-sand/40">
                  {m.notifyChannel === 'email' ? (
                    <>
                      <Mail className="h-3 w-3" /> emailed
                    </>
                  ) : (
                    <>
                      <MonitorSmartphone className="h-3 w-3" /> in-app
                    </>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
