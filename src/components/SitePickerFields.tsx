import { Search, MapPin, Tent, ChevronLeft, Loader2 } from 'lucide-react'
import type { SitePicker } from '../lib/useSitePicker'

/**
 * The park-search + facility-grid steps, shared by the "new tracker" form
 * and the "clone to a different site" flow on an existing tracker.
 */
export function SitePickerFields({ picker }: { picker: SitePicker }) {
  const {
    query,
    setQuery,
    parks,
    searching,
    park,
    facilities,
    loadingFacilities,
    facility,
    setFacility,
    pickPark,
    reset,
  } = picker

  return (
    <div className="space-y-4">
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
    </div>
  )
}
