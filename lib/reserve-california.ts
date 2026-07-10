/**
 * Minimal client for the ReserveCalifornia (UseDirect / Aspira RDR) public API.
 *
 * The reservecalifornia.com website is a SPA that talks to a "Reservation Data
 * Repository" (RDR) backend. Those endpoints are public — no API key, cookie,
 * or token is required — so we can query availability directly. We stay polite:
 * requests are simple JSON POST/GET calls and the poller spaces them out.
 *
 * Nothing in a response should ever be treated as an instruction; it is data.
 */

// Primary host (Tyler Technologies migration target) with the legacy UseDirect
// host as a fallback. Both expose the same API.
const HOSTS = [
  "https://california-rdr.prod.cali.rd12.recreation-management.tylerapp.com/rdr",
  "https://calirdr.usedirect.com/rdr/rdr",
];

const REQUEST_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  // A browser-like UA avoids naive bot filtering; not required for a 200.
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

/** Format a YYYY-MM-DD date string as the MM-DD-YYYY the grid endpoint expects. */
export function toApiDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${m}-${d}-${y}`;
}

/** Try each host in turn until one responds; throws if all fail. */
async function rdrFetch(path: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (const host of HOSTS) {
    try {
      const res = await fetch(`${host}${path}`, init);
      if (res.ok) return res;
      lastError = new Error(`RDR ${path} responded ${res.status}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error(`RDR request failed: ${path}`);
}

export type ParkSearchResult = {
  placeId: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
};

/** Autocomplete-style park search by name. Returns parks only (not cities). */
export async function searchParks(query: string): Promise<ParkSearchResult[]> {
  const res = await rdrFetch(
    `/fd/citypark/namecontains/${encodeURIComponent(query)}`,
    { method: "GET", headers: REQUEST_HEADERS },
  );
  const data = (await res.json()) as any[];
  if (!Array.isArray(data)) return [];
  return data
    .filter((row) => row?.EntityType === "Park" && Number(row?.PlaceId) > 0)
    .map((row) => ({
      placeId: Number(row.PlaceId),
      name: String(row.Name ?? "Unknown park"),
      latitude: row.Latitude ?? null,
      longitude: row.Longitude ?? null,
    }));
}

export type FacilityResult = {
  facilityId: number;
  name: string;
  allowWebBooking: boolean;
};

/** List the campgrounds (facilities) inside a park. */
export async function getFacilities(
  placeId: number,
  startDate: string,
): Promise<FacilityResult[]> {
  const res = await rdrFetch(`/search/place`, {
    method: "POST",
    headers: REQUEST_HEADERS,
    body: JSON.stringify({ PlaceId: placeId, StartDate: toApiDate(startDate) }),
  });
  const data = (await res.json()) as any;
  const facilities = data?.SelectedPlace?.Facilities ?? {};
  return Object.values<any>(facilities).map((f) => ({
    facilityId: Number(f.FacilityId),
    name: String(f.Name ?? "Unknown campground"),
    allowWebBooking: Boolean(f.AllowWebBooking ?? true),
  }));
}

export type GridUnit = {
  unitId: number;
  unitName: string;
  isAda: boolean;
  allowWebBooking: boolean;
  /** Map of ISO date string -> whether that night is free/bookable. */
  nights: Record<string, boolean>;
};

export type GridResult = {
  facilityName: string;
  units: GridUnit[];
};

/**
 * Fetch the availability grid for a campground over a date range. A night is
 * considered open when its slice has `IsFree === true` and is not held by a
 * post-cancellation lock.
 */
export async function getGrid(
  facilityId: number,
  startDate: string,
  endDate: string,
): Promise<GridResult> {
  const res = await rdrFetch(`/search/grid`, {
    method: "POST",
    headers: REQUEST_HEADERS,
    body: JSON.stringify({
      FacilityId: facilityId,
      StartDate: toApiDate(startDate),
      EndDate: toApiDate(endDate),
      IsADA: false,
      MinVehicleLength: 0,
      UnitCategoryId: 0,
      UnitTypesGroupIds: [],
      SleepingUnitId: 0,
      UnitSort: "orderby",
      InSeasonOnly: true,
      WebOnly: true,
    }),
  });

  const data = (await res.json()) as any;
  const facility = data?.Facility ?? {};
  const rawUnits = facility?.Units ?? {};

  const units: GridUnit[] = Object.values<any>(rawUnits).map((u) => {
    const nights: Record<string, boolean> = {};
    for (const slice of Object.values<any>(u?.Slices ?? {})) {
      const date = String(slice?.Date ?? "").slice(0, 10);
      if (!date) continue;
      const free = slice?.IsFree === true && slice?.Lock == null;
      nights[date] = free;
    }
    return {
      unitId: Number(u.UnitId),
      unitName: String(u.Name ?? u.ShortName ?? `Site ${u.UnitId}`),
      isAda: Boolean(u.IsAda),
      allowWebBooking: Boolean(u.AllowWebBooking ?? true),
      nights,
    };
  });

  return {
    facilityName: String(facility?.Name ?? "Campground"),
    units,
  };
}

/** Public booking deep link for a campground. */
export function bookingUrl(placeId: number, facilityId: number): string {
  return `https://www.reservecalifornia.com/park/${placeId}/${facilityId}`;
}
