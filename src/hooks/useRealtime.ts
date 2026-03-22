import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type LocationRow = Database['public']['Tables']['locations']['Row']

export function useRealtimeLocations() {
  const [locations, setLocations] = useState<LocationRow[]>([])

  useEffect(() => {
    // Initial fetch
    supabase
      .from('locations')
      .select('*')
      .then(({ data }) => {
        if (data) setLocations(data)
      })

    // Subscribe to realtime changes
    const channel = supabase
      .channel('locations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setLocations((prev) => {
              const idx = prev.findIndex((l) => l.userId === (payload.new as LocationRow).userId)
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = payload.new as LocationRow
                return next
              }
              return [...prev, payload.new as LocationRow]
            })
          } else if (payload.eventType === 'DELETE') {
            setLocations((prev) => prev.filter((l) => l.userId !== (payload.old as LocationRow).userId))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return locations
}
