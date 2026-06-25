import { useCallback, useEffect, useState } from 'react'
import {
  Box,
  Heading,
  Text,
  HStack,
  VStack,
  Avatar,
  Input,
  Badge,
  Spinner,
  Center,
  Divider,
  useToast,
} from '@chakra-ui/react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

type Person = { id: string; displayName: string; email: string }
type RequestItem = { requestId: string; person: Person }

export default function FriendsTab() {
  const { user } = useAuth()
  const toast = useToast()

  const [friends, setFriends] = useState<Person[]>([])
  const [incoming, setIncoming] = useState<RequestItem[]>([])
  const [outgoing, setOutgoing] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [searching, setSearching] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      // friends
      const { data: fRows } = await supabase
        .from('user_friends')
        .select('friendId')
        .eq('userId', user.id)
      const friendIds = (fRows ?? []).map((r) => r.friendId)

      // pending requests (both directions)
      const { data: reqs } = await supabase
        .from('friend_requests')
        .select('id, requesterId, addresseeId, status')
        .eq('status', 'pending')

      const incomingRaw = (reqs ?? []).filter((r) => r.addresseeId === user.id)
      const outgoingRaw = (reqs ?? []).filter((r) => r.requesterId === user.id)

      const ids = Array.from(
        new Set([
          ...friendIds,
          ...incomingRaw.map((r) => r.requesterId),
          ...outgoingRaw.map((r) => r.addresseeId),
        ]),
      )
      const people = new Map<string, Person>()
      if (ids.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, displayName, email')
          .in('id', ids)
        for (const u of users ?? []) people.set(u.id, u)
      }
      const get = (id: string): Person => people.get(id) ?? { id, displayName: '不明なユーザー', email: '' }

      setFriends(friendIds.map(get))
      setIncoming(incomingRaw.map((r) => ({ requestId: r.id, person: get(r.requesterId) })))
      setOutgoing(outgoingRaw.map((r) => ({ requestId: r.id, person: get(r.addresseeId) })))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  async function handleSearch() {
    if (!user || !query.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const q = `%${query.trim()}%`
      const { data } = await supabase
        .from('users')
        .select('id, displayName, email')
        .or(`displayName.ilike.${q},email.ilike.${q}`)
        .neq('id', user.id)
        .limit(10)
      const excluded = new Set([
        ...friends.map((f) => f.id),
        ...incoming.map((i) => i.person.id),
        ...outgoing.map((o) => o.person.id),
      ])
      setResults((data ?? []).filter((u) => !excluded.has(u.id)))
    } finally {
      setSearching(false)
    }
  }

  async function sendRequest(target: Person) {
    if (!user) return
    setBusyId(target.id)
    try {
      const { error } = await supabase
        .from('friend_requests')
        .insert({ requesterId: user.id, addresseeId: target.id })
      if (error) {
        toast({ status: 'error', title: '申請できませんでした', description: error.message })
        return
      }
      toast({ status: 'success', title: `${target.displayName} に申請しました` })
      setResults((prev) => prev.filter((r) => r.id !== target.id))
      await loadAll()
    } finally {
      setBusyId(null)
    }
  }

  async function accept(item: RequestItem) {
    setBusyId(item.requestId)
    try {
      const { error } = await supabase.rpc('accept_friend_request', { request_id: item.requestId })
      if (error) {
        toast({ status: 'error', title: '承認できませんでした', description: error.message })
        return
      }
      toast({ status: 'success', title: `${item.person.displayName} と友だちになりました` })
      await loadAll()
    } finally {
      setBusyId(null)
    }
  }

  async function decline(item: RequestItem) {
    setBusyId(item.requestId)
    try {
      await supabase.from('friend_requests').delete().eq('id', item.requestId)
      await loadAll()
    } finally {
      setBusyId(null)
    }
  }

  async function cancel(item: RequestItem) {
    setBusyId(item.requestId)
    try {
      await supabase.from('friend_requests').delete().eq('id', item.requestId)
      await loadAll()
    } finally {
      setBusyId(null)
    }
  }

  async function unfriend(person: Person) {
    setBusyId(person.id)
    try {
      const { error } = await supabase.rpc('remove_friend', { other_id: person.id })
      if (error) {
        toast({ status: 'error', title: '解除できませんでした', description: error.message })
        return
      }
      await loadAll()
    } finally {
      setBusyId(null)
    }
  }

  function PersonRow({ person, children }: { person: Person; children: React.ReactNode }) {
    return (
      <HStack justify="space-between" spacing={3}>
        <HStack spacing={3} minW={0}>
          <Avatar size="sm" name={person.displayName} bg="primary.500" color="white" />
          <Box minW={0}>
            <Text fontSize="sm" fontWeight="600" color="gray.800" noOfLines={1}>
              {person.displayName}
            </Text>
            {person.email && (
              <Text fontSize="xs" color="gray.500" noOfLines={1}>
                {person.email}
              </Text>
            )}
          </Box>
        </HStack>
        <HStack spacing={2} flexShrink={0}>
          {children}
        </HStack>
      </HStack>
    )
  }

  return (
    <VStack align="stretch" spacing={6}>
      <Box>
        <Heading size="lg" letterSpacing="tight">
          フレンド
        </Heading>
        <Text color="gray.600" mt={1}>
          友だちになると、公開範囲「友だち」の位置・予定を共有できます。
        </Text>
      </Box>

      {/* Search / add */}
      <Card>
        <Heading size="sm" mb={3}>
          ユーザーを探して申請
        </Heading>
        <HStack>
          <Input
            placeholder="表示名またはメールで検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} isLoading={searching} flexShrink={0}>
            検索
          </Button>
        </HStack>
        {results.length > 0 && (
          <VStack align="stretch" spacing={3} mt={4}>
            {results.map((p) => (
              <PersonRow key={p.id} person={p}>
                <Button
                  size="sm"
                  variant="signal"
                  isLoading={busyId === p.id}
                  onClick={() => sendRequest(p)}
                >
                  申請
                </Button>
              </PersonRow>
            ))}
          </VStack>
        )}
      </Card>

      {loading ? (
        <Center py={10}>
          <Spinner color="primary.500" thickness="3px" />
        </Center>
      ) : (
        <>
          {incoming.length > 0 && (
            <Card>
              <Heading size="sm" mb={3}>
                受け取った申請 <Badge colorScheme="signal">{incoming.length}</Badge>
              </Heading>
              <VStack align="stretch" spacing={3}>
                {incoming.map((item) => (
                  <PersonRow key={item.requestId} person={item.person}>
                    <Button size="sm" variant="signal" isLoading={busyId === item.requestId} onClick={() => accept(item)}>
                      承認
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => decline(item)}>
                      拒否
                    </Button>
                  </PersonRow>
                ))}
              </VStack>
            </Card>
          )}

          {outgoing.length > 0 && (
            <Card>
              <Heading size="sm" mb={3}>
                送った申請
              </Heading>
              <VStack align="stretch" spacing={3}>
                {outgoing.map((item) => (
                  <PersonRow key={item.requestId} person={item.person}>
                    <Badge colorScheme="gray">承認待ち</Badge>
                    <Button size="sm" variant="ghost" onClick={() => cancel(item)}>
                      取消
                    </Button>
                  </PersonRow>
                ))}
              </VStack>
            </Card>
          )}

          <Card>
            <Heading size="sm" mb={3}>
              友だち <Badge>{friends.length}</Badge>
            </Heading>
            {friends.length === 0 ? (
              <Text color="gray.500" py={2}>
                まだ友だちがいません。上の検索から申請してみましょう。
              </Text>
            ) : (
              <VStack align="stretch" spacing={3} divider={<Divider />}>
                {friends.map((p) => (
                  <PersonRow key={p.id} person={p}>
                    <Button size="sm" variant="secondary" isLoading={busyId === p.id} onClick={() => unfriend(p)}>
                      解除
                    </Button>
                  </PersonRow>
                ))}
              </VStack>
            )}
          </Card>
        </>
      )}
    </VStack>
  )
}
