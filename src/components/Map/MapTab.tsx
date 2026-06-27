import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import {
  Box,
  Button,
  Checkbox,
  Flex,
  HStack,
  Text,
  Select,
  VStack,
  Alert,
  AlertIcon,
  Badge,
  Input,
  InputGroup,
  InputLeftElement,
  List,
  ListItem,
  Avatar,
  Switch,
  FormLabel,
} from '@chakra-ui/react'
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

const DEFAULT_ZOOM = 13

// Live-sharing throttle: only auto-upsert when enough time has passed AND the
// user has moved enough — saves battery and DB writes.
const LIVE_MIN_INTERVAL_MS = 15_000
const LIVE_MIN_DISTANCE_M = 25
// While live, refresh others' pins on this cadence.
const LIVE_REFRESH_MS = 20_000

function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

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

function TripleClickRecenter({ position }: { position: LatLng | null }) {
  const map = useMap()
  const clickCount = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useMapEvents({
    click() {
      clickCount.current += 1
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => { clickCount.current = 0 }, 500)
      if (clickCount.current >= 2 && position) {
        map.setView([position.lat, position.lng], DEFAULT_ZOOM)
        clickCount.current = 0
      }
    },
  })

  return null
}

// Pan/zoom the map to a chosen person. `nonce` lets repeated selections of the
// same person re-trigger the fly-to.
function FlyToTarget({ target }: { target: { pos: LatLng; nonce: number } | null }) {
  const map = useMap()

  useEffect(() => {
    if (target) {
      map.flyTo([target.pos.lat, target.pos.lng], Math.max(map.getZoom(), DEFAULT_ZOOM))
    }
  }, [map, target])

  return null
}

export default function MapTab() {
  const { user, teams } = useAuth()
  const { locations, fetchLocations } = useRealtimeLocations()
  const [sharingState, setSharingState] = useState<LocationRow['sharingState']>('private')
  // Teams to share the location with when sharingState === 'team'. Empty = all teams.
  const [sharedTeams, setSharedTeams] = useState<Set<string>>(new Set())
  const [currentPosition, setCurrentPosition] = useState<LatLng | null>(null)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [tileLayer, setTileLayer] = useState<TileLayerKey>('map')
  // displayName for every teammate (across all of the user's teams)
  const [memberNames, setMemberNames] = useState<Map<string, string>>(new Map())
  // displayName for every friend
  const [friendNames, setFriendNames] = useState<Map<string, string>>(new Map())
  // "find people" search box
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [flyTarget, setFlyTarget] = useState<{ pos: LatLng; nonce: number } | null>(null)
  // Live sharing: auto-upsert location as the user moves (vs. manual button).
  const [liveSharing, setLiveSharing] = useState(false)
  // Latest auto-send fn + last-sent marker, read from the geolocation watch.
  const autoSendRef = useRef<(pos: LatLng) => void>(() => {})
  const lastSentRef = useRef<{ at: number; pos: LatLng } | null>(null)

  const teamIds = useMemo(() => teams.map((t) => t.id), [teams])

  const fetchTeamMembers = useCallback(async () => {
    if (teamIds.length === 0) {
      setMemberNames(new Map())
      return
    }
    const { data: rows } = await supabase
      .from('user_teams')
      .select('userId')
      .in('teamId', teamIds)
    const ids = Array.from(new Set((rows ?? []).map((r) => r.userId)))
    if (ids.length === 0) {
      setMemberNames(new Map())
      return
    }
    const { data: users } = await supabase
      .from('users')
      .select('id, displayName')
      .in('id', ids)
    setMemberNames(new Map((users ?? []).map((u) => [u.id, u.displayName])))
  }, [teamIds])

  const fetchFriends = useCallback(async () => {
    if (!user) {
      setFriendNames(new Map())
      return
    }
    const { data: rows } = await supabase
      .from('user_friends')
      .select('friendId')
      .eq('userId', user.id)
    const ids = Array.from(new Set((rows ?? []).map((r) => r.friendId)))
    if (ids.length === 0) {
      setFriendNames(new Map())
      return
    }
    const { data: users } = await supabase
      .from('users')
      .select('id, displayName')
      .in('id', ids)
    setFriendNames(new Map((users ?? []).map((u) => [u.id, u.displayName])))
  }, [user])

  // displayName for anyone we're allowed to see (teammates + friends).
  const knownNames = useMemo(() => {
    const merged = new Map(memberNames)
    for (const [id, name] of friendNames) merged.set(id, name)
    return merged
  }, [memberNames, friendNames])

  // Show pins for teammates and friends (and always your own).
  const markers = useMemo(
    () =>
      locations.filter(
        (loc) =>
          loc.lat !== null &&
          loc.lng !== null &&
          (loc.userId === user?.id || knownNames.has(loc.userId)),
      ),
    [locations, knownNames, user?.id],
  )

  // People who currently have a visible location, for the "find people" box.
  const findablePeople = useMemo(
    () =>
      markers
        .filter((loc) => loc.userId !== user?.id)
        .map((loc) => ({
          id: loc.userId,
          name: knownNames.get(loc.userId) ?? 'メンバー',
          pos: { lat: loc.lat as number, lng: loc.lng as number },
        })),
    [markers, knownNames, user?.id],
  )

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return findablePeople
    return findablePeople.filter((p) => p.name.toLowerCase().includes(q))
  }, [searchQuery, findablePeople])

  useEffect(() => {
    void fetchLocations()
  }, [fetchLocations])

  useEffect(() => {
    void fetchTeamMembers()
  }, [fetchTeamMembers])

  useEffect(() => {
    void fetchFriends()
  }, [fetchFriends])

  useEffect(() => {
    if (!user) return
    if (!('geolocation' in navigator)) {
      setPermissionError('このブラウザでは位置情報が利用できません。')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setPermissionError(null)
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        setCurrentPosition(pos)
        autoSendRef.current(pos)
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
    async (position: LatLng, state: LocationRow['sharingState'], sharedTeamIds: string[]) => {
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
              // Only meaningful for 'team'; keep empty otherwise.
              sharedTeamIds: state === 'team' ? sharedTeamIds : [],
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

  // Keep the geolocation watch's auto-send pointed at the latest settings,
  // applying the time/distance throttle.
  useEffect(() => {
    autoSendRef.current = (pos: LatLng) => {
      if (!liveSharing) return
      const now = Date.now()
      const last = lastSentRef.current
      if (
        last &&
        now - last.at < LIVE_MIN_INTERVAL_MS &&
        distanceMeters(last.pos, pos) < LIVE_MIN_DISTANCE_M
      ) {
        return
      }
      lastSentRef.current = { at: now, pos }
      void upsertLocation(pos, sharingState, Array.from(sharedTeams))
    }
  }, [liveSharing, sharingState, sharedTeams, upsertLocation])

  // On turning live ON, send the current position immediately.
  useEffect(() => {
    if (liveSharing && currentPosition) {
      lastSentRef.current = { at: Date.now(), pos: currentPosition }
      void upsertLocation(currentPosition, sharingState, Array.from(sharedTeams))
    }
    // Only re-run when toggled, not on every position tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSharing])

  // While live, periodically refresh others' pins.
  useEffect(() => {
    if (!liveSharing) return
    const id = setInterval(() => {
      void fetchLocations()
    }, LIVE_REFRESH_MS)
    return () => clearInterval(id)
  }, [liveSharing, fetchLocations])

  const handleRefresh = useCallback(async () => {
    if (!user || !currentPosition) return
    await upsertLocation(currentPosition, sharingState, Array.from(sharedTeams))
    await Promise.all([fetchLocations(), fetchTeamMembers(), fetchFriends()])
  }, [
    user,
    currentPosition,
    sharingState,
    sharedTeams,
    upsertLocation,
    fetchLocations,
    fetchTeamMembers,
    fetchFriends,
  ])

  const focusPerson = useCallback((pos: LatLng) => {
    setFlyTarget({ pos, nonce: Date.now() })
    setSearchQuery('')
    setSearchFocused(false)
  }, [])

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
          <Text color="gray.600">「ライブ共有」をオンにすると、現在地が自動で送信され続けます。手動で送りたいときは「マップを更新」を押してください。左上の検索から特定の人を探せます。</Text>
          <HStack spacing={3} flexWrap="wrap">
            <Badge colorScheme={sharingState === 'private' ? 'gray' : sharingState === 'friends' ? 'blue' : 'purple'}>
              {sharingState}
            </Badge>
            <HStack spacing={2}>
              <FormLabel htmlFor="live-sharing" mb={0} fontSize="sm">
                ライブ共有
              </FormLabel>
              <Switch
                id="live-sharing"
                colorScheme="green"
                isChecked={liveSharing}
                isDisabled={!currentPosition}
                onChange={(e) => setLiveSharing(e.target.checked)}
              />
              {liveSharing && (
                <Badge colorScheme="green" variant="subtle">
                  ● ライブ
                </Badge>
              )}
            </HStack>
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

          {/* When sharing to teams, pick which teams (none = all your teams) */}
          {sharingState === 'team' && teams.length > 0 && (
            <Box mt={3}>
              <Text mb={1} fontSize="sm" fontWeight="medium">
                共有するチーム
              </Text>
              <Text mb={2} fontSize="xs" color="gray.500">
                未選択の場合は所属する全チームに共有します。
              </Text>
              <VStack align="stretch" spacing={2}>
                {teams.map((t) => (
                  <Checkbox
                    key={t.id}
                    isChecked={sharedTeams.has(t.id)}
                    onChange={() =>
                      setSharedTeams((prev) => {
                        const next = new Set(prev)
                        if (next.has(t.id)) next.delete(t.id)
                        else next.add(t.id)
                        return next
                      })
                    }
                  >
                    <Text fontSize="sm">{t.teamName}</Text>
                  </Checkbox>
                ))}
              </VStack>
              <Text mt={2} fontSize="xs" color="gray.400">
                変更後は「マップを更新」で反映されます。
              </Text>
            </Box>
          )}
        </Box>
      </Flex>

      {permissionError && (
        <Alert status="error" mb={4} borderRadius="lg">
          <AlertIcon />{permissionError}
        </Alert>
      )}

      <Box h="calc(100vh - 280px)" position="relative">
        {/* Find people: search teammates/friends who are sharing their location */}
        <Box position="absolute" top={2} left={2} zIndex={1000} w={{ base: '70%', sm: '280px' }}>
          <InputGroup bg="white" borderRadius="md" boxShadow="md">
            <InputLeftElement pointerEvents="none" color="gray.400">
              🔍
            </InputLeftElement>
            <Input
              placeholder="人を探す（表示名）"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              // Delay so a click on a list item registers before the list closes.
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              bg="white"
              borderRadius="md"
            />
          </InputGroup>
          {searchFocused && (
            <List
              mt={1}
              bg="white"
              borderRadius="md"
              boxShadow="md"
              maxH="240px"
              overflowY="auto"
            >
              {searchResults.length === 0 ? (
                <ListItem px={3} py={2} fontSize="sm" color="gray.500">
                  位置を共有している人がいません
                </ListItem>
              ) : (
                searchResults.map((p) => (
                  <ListItem
                    key={p.id}
                    px={3}
                    py={2}
                    cursor="pointer"
                    _hover={{ bg: 'gray.100' }}
                    onClick={() => focusPerson(p.pos)}
                  >
                    <HStack spacing={2}>
                      <Avatar size="xs" name={p.name} bg="primary.500" color="white" />
                      <Text fontSize="sm">{p.name}</Text>
                    </HStack>
                  </ListItem>
                ))
              )}
            </List>
          )}
        </Box>
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
          zoom={DEFAULT_ZOOM}
          doubleClickZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution={TILE_LAYERS[tileLayer].attribution}
            url={TILE_LAYERS[tileLayer].url}
          />
          {currentPosition && <RecenterMap position={currentPosition} />}
          <TripleClickRecenter position={currentPosition} />
          <FlyToTarget target={flyTarget} />
          {markers.map((loc) => (
            <Marker
              key={loc.userId}
              position={[loc.lat ?? 0, loc.lng ?? 0]}
              icon={MapPin(loc.userId === user?.id ? '#2B6CB0' : undefined)}
            >
              <Popup>
                {loc.userId === user?.id
                  ? 'あなた'
                  : knownNames.get(loc.userId) ?? 'メンバー'}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </Box>
    </Box>
  )
}
