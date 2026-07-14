import { useEffect, useRef, useState } from 'react'
import { BellRing, Check, ChevronDown, Loader2, Send } from 'lucide-react'
import { api, localTimeToUtcHHMM, utcHHMMToLocalTime, type AuthUser } from '../lib/api'

type Props = {
  user: AuthUser
  onUpdated: (user: AuthUser) => void
}

export function AccountMenu({ user, onUpdated }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const [notifyImmediate, setNotifyImmediate] = useState(user.notifyImmediate)
  const [notifyDailyDigest, setNotifyDailyDigest] = useState(user.notifyDailyDigest)
  const [notifyDailySites, setNotifyDailySites] = useState(user.notifyDailySites)
  const [dailyLocalTime, setDailyLocalTime] = useState(utcHHMMToLocalTime(user.dailySitesTime))

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<'ok' | 'error' | null>(null)

  function openMenu() {
    setNotifyImmediate(user.notifyImmediate)
    setNotifyDailyDigest(user.notifyDailyDigest)
    setNotifyDailySites(user.notifyDailySites)
    setDailyLocalTime(utcHHMMToLocalTime(user.dailySitesTime))
    setError(null)
    setSaved(false)
    setSendResult(null)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const updated = await api.updatePreferences({
        notifyImmediate,
        notifyDailyDigest,
        notifyDailySites,
        dailySitesTime: localTimeToUtcHHMM(dailyLocalTime),
      })
      onUpdated(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function sendNow() {
    setSending(true)
    setSendResult(null)
    try {
      await api.sendAvailabilityNow()
      setSendResult('ok')
    } catch {
      setSendResult('error')
    } finally {
      setSending(false)
      setTimeout(() => setSendResult(null), 4000)
    }
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => (open ? setOpen(false) : openMenu())}
        className="flex items-center gap-1.5 rounded-lg border border-pine/12 bg-paper/70 px-3 py-1.5 text-sm font-medium text-pine-soft transition hover:border-pine/25"
      >
        {user.email}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 space-y-4 rounded-2xl border border-pine/10 bg-white p-5 text-left shadow-xl">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-bold text-pine">
              <BellRing className="h-4 w-4 text-ocean" /> Email notifications
            </p>
            <div className="mt-3 space-y-2.5">
              <label className="flex items-start gap-2.5 text-sm text-pine">
                <input
                  type="checkbox"
                  checked={notifyImmediate}
                  onChange={(e) => setNotifyImmediate(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-ocean"
                />
                <span>
                  <span className="font-semibold">Immediate</span>
                  <span className="block text-xs text-pine-soft">
                    The first time a site opens for a tracker's dates
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2.5 text-sm text-pine">
                <input
                  type="checkbox"
                  checked={notifyDailyDigest}
                  onChange={(e) => setNotifyDailyDigest(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-ocean"
                />
                <span>
                  <span className="font-semibold">Daily digest</span>
                  <span className="block text-xs text-pine-soft">
                    A recap of sites that newly opened today
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2.5 text-sm text-pine">
                <input
                  type="checkbox"
                  checked={notifyDailySites}
                  onChange={(e) => setNotifyDailySites(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-ocean"
                />
                <span className="flex-1">
                  <span className="font-semibold">Daily email of sites</span>
                  <span className="block text-xs text-pine-soft">
                    Every currently-open site across your active trackers
                  </span>
                  {notifyDailySites && (
                    <input
                      type="time"
                      value={dailyLocalTime}
                      onChange={(e) => setDailyLocalTime(e.target.value)}
                      className="mt-1.5 rounded-lg border border-pine/15 bg-sand/60 px-2.5 py-1.5 text-sm text-pine outline-none focus:border-ocean focus:bg-white"
                    />
                  )}
                </span>
              </label>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-clay/10 px-3 py-2 text-xs font-medium text-clay">{error}</p>
          )}

          <button
            onClick={save}
            disabled={saving}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-ocean px-4 py-2 text-sm font-bold text-paper shadow transition hover:bg-ocean-deep disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : null}
            {saved ? 'Saved' : 'Save preferences'}
          </button>

          <div className="border-t border-pine/10 pt-4">
            <button
              onClick={sendNow}
              disabled={sending}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-pine/15 px-4 py-2 text-sm font-semibold text-pine transition hover:border-ocean/40 hover:text-ocean-deep disabled:opacity-60"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send availability now
            </button>
            {sendResult === 'ok' && (
              <p className="mt-1.5 text-center text-xs font-medium text-ocean-deep">
                Sent — check your inbox.
              </p>
            )}
            {sendResult === 'error' && (
              <p className="mt-1.5 text-center text-xs font-medium text-clay">Couldn't send that email.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
