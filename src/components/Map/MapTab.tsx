import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { Box, Button, Flex, HStack, Text, Select, VStack, Alert, AlertIcon, Badge } from '@chakra-ui/react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useRealtimeLocations } from '../../hooks/useRealtime'
import { MapPin } from './MapPin'
import type { Database } from '../../types/database'

type LocationRow = Database['public']['Tables']['locations']['Row']

type LatLng = { lat: number; lng: number }

const TILE_LAYERS = {
  map: {
    label: '地図',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    label: '航空写真',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
  },
  transit: {
    label: '公共交通',
    url: 'https://tile.memomaps.de/tilegen/{z}/{x}/{y}.png',
    attribution: 'Map <a href="https://memomaps.de/">memomaps.de</a> <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
} as const

type TileLayerKey = keyof typeof TILE_LAYERS

function RecenterMap({ position }: { position: LatLng | null }) {
  const map = useMap()
  const centered = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 100)
    return () => clearTimeout(timer)
  }, [map])

  useEffect(() => {
    if (position && !centered.current) {
      map.setView([position.lat, position.lng], map.getZoom())
      centered.current = true
    }
  }, [map, position])

  return null
}

export default function MapTab() {
  const { user } = useAuth()
  const { locations, fetchLocations } = useRealtimeLocations()
  const [sharingState, setSharingState] = useState<LocationRow['sharingState']>('private')
  const [currentPosition, setCurrentPosition] = useState<LatLng | null>(null)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [tileLayer, setTileLayer] = useState<TileLayerKey>('map')

  const markers = useMemo(
    () => locations.filter((loc) => loc.lat !== null && loc.lng !== null),
    [locations],
  )

  useEffect(() => {
    void fetchLocations()
  }, [fetchLocations])

  useEffect(() => {
    if (!user) return
    if (!('geolocation' in navigator)) {
      setPermissionError('このブラウザでは位置情報が利用できません。')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setPermissionError(null)
        setCurrentPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      (error) => {
        setPermissionError(error.message || '位置情報の取得に失敗しました。')
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000,
      },
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [user])

  const upsertLocation = useCallback(
    async (position: LatLng, state: LocationRow['sharingState']) => {
      if (!user) return
      setSaving(true)
      try {
        const { error } = await supabase
          .from('locations')
          .upsert(
            {
              userId: user.id,
              lat: position.lat,
              lng: position.lng,
              sharingState: state,
            },
            { onConflict: 'userId' },
          )
          .select()

        if (error) {
          console.error('location upsert error', error)
        } else {
          setLastSavedAt(new Date().toLocaleTimeString())
        }
      } finally {
        setSaving(false)
      }
    },
    [user],
  )

  const handleRefresh = useCallback(async () => {
    if (!user || !currentPosition) return
    await upsertLocation(currentPosition, sharingState)
    await fetchLocations()
  }, [user, currentPosition, sharingState, upsertLocation, fetchLocations])

  const currentPositionLabel = currentPosition
    ? `${currentPosition.lat.toFixed(5)}, ${currentPosition.lng.toFixed(5)}`
    : '位置情報を待機中...'

  return (
    <Box bg="white" p={6} borderRadius="lg" boxShadow="sm" minH="calc(100vh - 160px)">
      <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" gap={4} mb={6}>
        <VStack align="flex-start" spacing={3} flex="1">
          <Text fontSize="2xl" fontWeight="semibold">
            マップ
          </Text>
          <Text color="gray.600">位置共有ステータスを選択すると、現在地が Supabase の locations テーブルへ送信されます。</Text>
          <HStack spacing={3} flexWrap="wrap">
            <Badge colorScheme={sharingState === 'private' ? 'gray' : sharingState === 'friends' ? 'blue' : 'purple'}>
              {sharingState}
            </Badge>
            <Text>{currentPositionLabel}</Text>
            <Text>{saving ? '保存中...' : lastSavedAt ? `最終更新: ${lastSavedAt}` : ''}</Text>
            <Button
              size="sm"
              colorScheme="blue"
              isLoading={saving}
              isDisabled={!currentPosition}
              onClick={() => void handleRefresh()}
            >
              マップを更新
            </Button>
          </HStack>
        </VStack>

        <Box minW="220px">
          <Text mb={2} fontWeight="medium">
            共有範囲
          </Text>
          <Select value={sharingState} onChange={(e) => setSharingState(e.target.value as LocationRow['sharingState'])}>
            <option value="private">private（自分のみ）</option>
            <option value="friends">friends（友達）</option>
            <option value="team">team（チーム）</option>
          </Select>
        </Box>
      </Flex>

      {permissionError && (
        <Alert status="error" mb={4} borderRadius="lg">
          <AlertIcon />{permissionError}
        </Alert>
      )}

      <Box h="calc(100vh - 280px)" position="relative">
        <HStack
          position="absolute"
          top={2}
          right={2}
          zIndex={1000}
          bg="white"
          borderRadius="md"
          boxShadow="md"
          p={1}
          spacing={1}
        >
          {(Object.keys(TILE_LAYERS) as TileLayerKey[]).map((key) => (
            <Button
              key={key}
              size="xs"
              colorScheme={tileLayer === key ? 'blue' : 'gray'}
              variant={tileLayer === key ? 'solid' : 'ghost'}
              onClick={() => setTileLayer(key)}
            >
              {TILE_LAYERS[key].label}
            </Button>
          ))}
        </HStack>
        <MapContainer
          center={currentPosition ? [currentPosition.lat, currentPosition.lng] : [35.6762, 139.6503]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution={TILE_LAYERS[tileLayer].attribution}
            url={TILE_LAYERS[tileLayer].url}
          />
          {currentPosition && <RecenterMap position={currentPosition} />}
          {markers.map((loc) => (
            <Marker
              key={loc.userId}
              position={[loc.lat ?? 0, loc.lng ?? 0]}
              icon={MapPin(loc.userId === user?.id ? '#2B6CB0' : undefined)}
            >
              <Popup>{loc.userId === user?.id ? 'あなた' : loc.userId}</Popup>
            </Marker>
          ))}
        </MapContainer>
      </Box>
    </Box>
  )
}
