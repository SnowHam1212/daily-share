import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { Box, Flex, HStack, Text, Select, VStack, Alert, AlertIcon, Badge } from '@chakra-ui/react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useRealtimeLocations } from '../../hooks/useRealtime'
import { MapPin } from './MapPin'
import type { Database } from '../../types/database'

type LocationRow = Database['public']['Tables']['locations']['Row']

type LatLng = { lat: number; lng: number }

function RecenterMap({ position }: { position: LatLng | null }) {
  const map = useMap()

  // 【追加】タブが開かれた直後に、地図のサイズを強制的に再計算させる（グレー画面対策）
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 100)
    return () => clearTimeout(timer)
  }, [map])

  // 位置情報が取得・更新されたら、その場所へカメラを移動させる
  useEffect(() => {
    if (position) {
      map.setView([position.lat, position.lng], map.getZoom())
    }
  }, [map, position])

  return null
}

export default function MapTab() {
  const { user } = useAuth()
  const locations = useRealtimeLocations()
  const [sharingState, setSharingState] = useState<LocationRow['sharingState']>('private')
  const [currentPosition, setCurrentPosition] = useState<LatLng | null>(null)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)

  const markers = useMemo(
    () => locations.filter((loc) => loc.lat !== null && loc.lng !== null),
    [locations],
  )

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

  useEffect(() => {
    if (!user || !currentPosition) return
    void upsertLocation(currentPosition, sharingState)
  }, [currentPosition, sharingState, upsertLocation, user])

  useEffect(() => {
    if (!user || !currentPosition) return

    const intervalId = window.setInterval(() => {
      void upsertLocation(currentPosition, sharingState)
    }, 10000)

    return () => window.clearInterval(intervalId)
  }, [currentPosition, sharingState, upsertLocation, user])

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

      <Box h="calc(100vh - 280px)">
        <MapContainer
          center={currentPosition ? [currentPosition.lat, currentPosition.lng] : [35.6762, 139.6503]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
