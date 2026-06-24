import { Box } from '@chakra-ui/react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { useRealtimeLocations } from '../../hooks/useRealtime'
import { MapPin } from './MapPin'

// Fix default marker icon (Leaflet + bundler issue)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

/**
 * Embeddable map for the Map tab. Unlike <Map>, it has no full-screen sizing
 * or sign-out button — the surrounding layout already provides those.
 */
export function MapView() {
  const locations = useRealtimeLocations()

  return (
    <Box
      borderRadius="2xl"
      overflow="hidden"
      border="1px solid"
      borderColor="gray.200"
      boxShadow="sm"
      h={{ base: '60vh', md: 'calc(100vh - 160px)' }}
    >
      <MapContainer
        center={[35.6762, 139.6503]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {locations
          .filter((loc) => loc.lat != null && loc.lng != null)
          .map((loc) => (
            <Marker key={loc.userId} position={[loc.lat as number, loc.lng as number]} icon={MapPin()}>
              <Popup>{loc.userId}</Popup>
            </Marker>
          ))}
      </MapContainer>
    </Box>
  )
}
