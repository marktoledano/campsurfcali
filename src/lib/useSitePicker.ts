import { useEffect, useRef, useState } from 'react'
import { api, type FacilityResult, type ParkResult } from './api'

/**
 * Shared park-search -> facility-pick flow used by both the "new tracker"
 * form and the "clone to a different site" flow on an existing tracker.
 */
export function useSitePicker(referenceStartDate: string) {
  const [query, setQuery] = useState('')
  const [parks, setParks] = useState<ParkResult[]>([])
  const [searching, setSearching] = useState(false)
  const [park, setPark] = useState<ParkResult | null>(null)

  const [facilities, setFacilities] = useState<FacilityResult[]>([])
  const [loadingFacilities, setLoadingFacilities] = useState(false)
  const [facility, setFacility] = useState<FacilityResult | null>(null)

  const [error, setError] = useState<string | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (park) return
    if (query.trim().length < 2) {
      setParks([])
      return
    }
    setSearching(true)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      try {
        setParks(await api.searchParks(query.trim()))
      } catch {
        setParks([])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => clearTimeout(debounce.current)
  }, [query, park])

  async function pickPark(p: ParkResult) {
    setPark(p)
    setParks([])
    setQuery(p.name)
    setFacility(null)
    setLoadingFacilities(true)
    setError(null)
    try {
      const list = await api.getFacilities(p.placeId, referenceStartDate)
      setFacilities(list)
      if (list.length === 0)
        setError('No campgrounds found for this park right now.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingFacilities(false)
    }
  }

  function reset() {
    setPark(null)
    setFacility(null)
    setFacilities([])
    setQuery('')
    setError(null)
  }

  return {
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
    error,
    setError,
  }
}

export type SitePicker = ReturnType<typeof useSitePicker>
