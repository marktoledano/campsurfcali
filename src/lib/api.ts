// Typed client for the SurfCampTrackerCali API routes.

export type AvailableUnit = {
  unitId: number
  unitName: string
  dates: string[]
}

export type DateRange = {
  startDate: string
  endDate: string
}

export type Watch = {
  id: number
  email: string
  parkName: string
  facilityName: string
  placeId: number
  facilityId: number
  dateRanges: DateRange[]
  minNights: number
  siteFilter: string | null
  adaOnly: boolean
  autoBook: boolean
  active: boolean
  lastCheckedAt: string | null
  lastResult: string
  availableCount: number
  currentAvailability: AvailableUnit[]
  createdAt: string | null
}

export type ParkResult = {
  placeId: number
  name: string
  latitude: number | null
  longitude: number | null
}

export type FacilityResult = {
  facilityId: number
  name: string
  allowWebBooking: boolean
}

export type MatchRow = {
  id: number
  unitName: string
  dates: string[]
  bookingUrl: string
  autoBook: boolean
  notifyChannel: string | null
  createdAt: string | null
  parkName: string
  facilityName: string
}

export type NewWatchInput = {
  email: string
  parkName: string
  facilityName: string
  placeId: number
  facilityId: number
  dateRanges: DateRange[]
  minNights: number
  siteFilter: string | null
  adaOnly: boolean
  autoBook: boolean
}

async function json<T>(resOrPromise: Response | Promise<Response>): Promise<T> {
  const res = await resOrPromise
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as any).error || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export const api = {
  searchParks: (park: string) =>
    json<{ parks: ParkResult[] }>(
      fetch(`/api/search?park=${encodeURIComponent(park)}`),
    ).then((r) => r.parks),

  getFacilities: (placeId: number, start: string) =>
    json<{ facilities: FacilityResult[] }>(
      fetch(`/api/search?placeId=${placeId}&start=${start}`),
    ).then((r) => r.facilities),

  listWatches: (email: string) =>
    json<{ watches: Watch[] }>(
      fetch(`/api/watches?email=${encodeURIComponent(email)}`),
    ).then((r) => r.watches),

  createWatch: (input: NewWatchInput) =>
    json<{ watch: Watch }>(
      fetch('/api/watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    ).then((r) => r.watch),

  patchWatch: (
    id: number,
    patch: {
      active?: boolean
      autoBook?: boolean
      adaOnly?: boolean
      siteFilter?: string | null
      minNights?: number
      dateRanges?: DateRange[]
    },
  ) =>
    json<{ watch: Watch }>(
      fetch(`/api/watches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    ).then((r) => r.watch),

  deleteWatch: (id: number) =>
    fetch(`/api/watches/${id}`, { method: 'DELETE' }).then((res) => {
      if (!res.ok && res.status !== 204) throw new Error('Failed to delete')
    }),

  pollNow: (watchId: number) =>
    json<{ watch: Watch }>(
      fetch('/api/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchId }),
      }),
    ).then((r) => r.watch),

  listMatches: (email: string) =>
    json<{ matches: MatchRow[] }>(
      fetch(`/api/matches?email=${encodeURIComponent(email)}`),
    ).then((r) => r.matches),
}

/** Compact date range formatting for display, e.g. "Aug 3 – Aug 6". */
export function formatDateRange(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
    })
  return `${fmt(start)} – ${fmt(end)}`
}

export function nightsBetween(start: string, end: string): number {
  const a = new Date(start + 'T00:00:00Z').getTime()
  const b = new Date(end + 'T00:00:00Z').getTime()
  return Math.max(1, Math.round((b - a) / 86_400_000))
}
