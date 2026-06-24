import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type LocationRow = Database['public']['Tables']['locations']['Row']

export function useRealtimeLocations() {
  const [locations, setLocations] = useState<LocationRow[]>([])

  const fetchLocations = useCallback(async () => {
    const { data } = await supabase.from('locations').select('*')
    if (data) setLocations(data)
  }, [])

  return { locations, fetchLocations }
}
