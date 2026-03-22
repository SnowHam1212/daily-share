import { Box } from '@chakra-ui/react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { useRealtimeLocations } from '../../hooks/useRealtime'
import { Button } from '../ui/Button'
import { MapPin } from './MapPin'

// Fix default marker icon (Leaflet + bundler issue)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface MapProps {
  onSignOut: () => void
}

export function Map({ onSignOut }: MapProps) {
  const locations = useRealtimeLocations()

  return (
    <Box position="relative" w="100%" h="100vh">
      <Button
        variant="secondary"
        size="sm"
        position="absolute"
        top={3}
        right={3}
        zIndex={1000}
        onClick={onSignOut}
      >
        ログアウト
      </Button>
      <MapContainer
        center={[35.6762, 139.6503]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {locations.map((loc) => (
          <Marker
            key={loc.userId}
            position={[loc.lat ?? 0, loc.lng ?? 0]}
            icon={MapPin()}
          >
            <Popup>{loc.userId}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </Box>
  )
}
