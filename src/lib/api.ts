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
  checkFrequencyMinutes: number
  lastCheckedAt: string | null
  lastResult: string
  availableCount: number
  currentAvailability: AvailableUnit[]
  createdAt: string | null
}

export type AuthUser = {
  id: number
  username: string
  email: string
  isAdmin: boolean
  createdAt: string | null
}

export type AdminUserRow = AuthUser & { trackerCount: number }

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
  parkName: string
  facilityName: string
  placeId: number
  facilityId: number
  dateRanges: DateRange[]
  minNights: number
  siteFilter: string | null
  adaOnly: boolean
  autoBook: boolean
  checkFrequencyMinutes?: number
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

  listWatches: () =>
    json<{ watches: Watch[] }>(fetch('/api/watches')).then((r) => r.watches),

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
      checkFrequencyMinutes?: number
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

  setFrequencyForAll: (checkFrequencyMinutes: number) =>
    json<{ watches: Watch[] }>(
      fetch('/api/watches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkFrequencyMinutes }),
      }),
    ).then((r) => r.watches),

  pollNow: (watchId: number) =>
    json<{ watch: Watch }>(
      fetch('/api/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchId }),
      }),
    ).then((r) => r.watch),

  listMatches: () =>
    json<{ matches: MatchRow[] }>(fetch('/api/matches')).then((r) => r.matches),

  register: (input: { username: string; email: string; password: string; confirmPassword: string }) =>
    json<{ user: AuthUser }>(
      fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    ).then((r) => r.user),

  login: (input: { username: string; password: string }) =>
    json<{ user: AuthUser }>(
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    ).then((r) => r.user),

  logout: () => fetch('/api/auth/logout', { method: 'POST' }).then(() => {}),

  me: () => json<{ user: AuthUser | null }>(fetch('/api/auth/me')).then((r) => r.user),

  adminListUsers: () =>
    json<{ users: AdminUserRow[] }>(fetch('/api/admin/users')).then((r) => r.users),

  adminSetAdmin: (id: number, isAdmin: boolean) =>
    json<{ user: AuthUser }>(
      fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin }),
      }),
    ).then((r) => r.user),

  adminDeleteUser: (id: number) =>
    fetch(`/api/admin/users/${id}`, { method: 'DELETE' }).then((res) => {
      if (!res.ok && res.status !== 204) throw new Error('Failed to delete user')
    }),
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

export const MIN_CHECK_FREQUENCY_MINUTES = 5

export type FrequencyUnit = 'minutes' | 'hours' | 'days'

/** Break a minutes value into the largest clean {value, unit} for display/editing. */
export function minutesToFrequency(minutes: number): { value: number; unit: FrequencyUnit } {
  if (minutes % 1440 === 0 && minutes >= 1440) return { value: minutes / 1440, unit: 'days' }
  if (minutes % 60 === 0 && minutes >= 60) return { value: minutes / 60, unit: 'hours' }
  return { value: minutes, unit: 'minutes' }
}

export function frequencyToMinutes(value: number, unit: FrequencyUnit): number {
  const perUnit = unit === 'days' ? 1440 : unit === 'hours' ? 60 : 1
  return Math.max(MIN_CHECK_FREQUENCY_MINUTES, Math.round(value * perUnit))
}

/** Compact display string, e.g. "every 15 min" / "every 2 hr" / "every 1 day". */
export function formatFrequency(minutes: number): string {
  const { value, unit } = minutesToFrequency(minutes)
  const label = unit === 'minutes' ? 'min' : unit === 'hours' ? 'hr' : value === 1 ? 'day' : 'days'
  return `every ${value} ${label}`
}
