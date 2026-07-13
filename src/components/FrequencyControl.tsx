import { useState } from 'react'
import { Clock3, Loader2, Check } from 'lucide-react'
import {
  api,
  frequencyToMinutes,
  localTimeToUtcHHMM,
  minutesToFrequency,
  utcHHMMToLocalTime,
  MIN_CHECK_FREQUENCY_MINUTES,
  type FrequencyUnit,
  type Watch,
} from '../lib/api'

type Props = {
  watches: Watch[]
  onAppliedToAll: (watches: Watch[]) => void
}

export function FrequencyControl({ watches, onAppliedToAll }: Props) {
  const allSameMode = watches.every((w) => w.scheduleMode === watches[0].scheduleMode)
  const initialMode = allSameMode ? watches[0].scheduleMode : 'interval'

  const allSameFreq = watches.every((w) => w.checkFrequencyMinutes === watches[0].checkFrequencyMinutes)
  const initialFreq = allSameFreq
    ? minutesToFrequency(watches[0].checkFrequencyMinutes)
    : { value: 5, unit: 'minutes' as FrequencyUnit }

  const allSameTime = watches.every((w) => w.dailyCheckTime === watches[0].dailyCheckTime)
  const initialLocalTime =
    allSameTime && watches[0].dailyCheckTime ? utcHHMMToLocalTime(watches[0].dailyCheckTime) : '08:00'

  const [mode, setMode] = useState<'interval' | 'daily'>(initialMode)
  const [value, setValue] = useState(initialFreq.value)
  const [unit, setUnit] = useState<FrequencyUnit>(initialFreq.unit)
  const [localTime, setLocalTime] = useState(initialLocalTime)
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState(false)

  async function apply() {
    setApplying(true)
    setDone(false)
    try {
      const updated = await api.setScheduleForAll(
        mode === 'daily'
          ? { scheduleMode: 'daily', dailyCheckTime: localTimeToUtcHHMM(localTime) }
          : { scheduleMode: 'interval', checkFrequencyMinutes: frequencyToMinutes(value, unit) },
      )
      onAppliedToAll(updated)
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-pine/10 bg-paper/70 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-pine-soft">
          <Clock3 className="h-4 w-4 text-ocean" /> Check frequency for all trackers
        </span>
        <div className="flex rounded-lg border border-pine/15 bg-white p-0.5 text-xs font-semibold">
          <button
            onClick={() => setMode('interval')}
            className={`rounded-md px-2.5 py-1.5 transition ${
              mode === 'interval' ? 'bg-ocean text-paper' : 'text-pine-soft hover:text-pine'
            }`}
          >
            Interval
          </button>
          <button
            onClick={() => setMode('daily')}
            className={`rounded-md px-2.5 py-1.5 transition ${
              mode === 'daily' ? 'bg-ocean text-paper' : 'text-pine-soft hover:text-pine'
            }`}
          >
            Daily at a time
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {mode === 'interval' ? (
          <>
            <input
              type="number"
              min={unit === 'minutes' ? MIN_CHECK_FREQUENCY_MINUTES : 1}
              value={value}
              onChange={(e) => setValue(Math.max(1, Number(e.target.value)))}
              className="w-20 rounded-lg border border-pine/15 bg-sand/60 px-3 py-2 text-sm text-pine outline-none focus:border-ocean focus:bg-white"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as FrequencyUnit)}
              className="rounded-lg border border-pine/15 bg-sand/60 px-3 py-2 text-sm text-pine outline-none focus:border-ocean focus:bg-white"
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
          </>
        ) : (
          <input
            type="time"
            value={localTime}
            onChange={(e) => setLocalTime(e.target.value)}
            className="rounded-lg border border-pine/15 bg-sand/60 px-3 py-2 text-sm text-pine outline-none focus:border-ocean focus:bg-white"
          />
        )}
        <button
          onClick={apply}
          disabled={applying}
          className="flex items-center gap-1.5 rounded-lg bg-ocean px-4 py-2 text-sm font-bold text-paper shadow transition hover:bg-ocean-deep disabled:opacity-60"
        >
          {applying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : done ? (
            <Check className="h-4 w-4" />
          ) : null}
          {done ? 'Applied' : 'Apply to all'}
        </button>
      </div>
      <p className="text-xs text-pine-soft">
        {mode === 'interval'
          ? `Minimum ${MIN_CHECK_FREQUENCY_MINUTES} minutes — the poller sweeps every 5 min.`
          : 'Checked once a day, shortly after the time you pick (poller sweeps every 5 min).'}
      </p>
    </div>
  )
}
