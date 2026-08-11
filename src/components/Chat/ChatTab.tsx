import { useState } from 'react'
import { Box, Heading, Text, VStack } from '@chakra-ui/react'
import { useAuth } from '../../hooks/useAuth'
import { Card } from '../ui/Card'
import { RoomList } from './RoomList'
import { RoomView } from './RoomView'

export default function ChatTab() {
  const { user, teams, refreshProfile } = useAuth()
  // 退出などで所属から外れた ID が残っても、描画時に teams.find で
  // フォールバックするため一覧へ自然に戻る（同期用の effect は不要）。
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

  if (teams.length === 0) {
    return (
      <Card>
        <Text color="gray.500" textAlign="center" py={6}>
          チームに参加するとトークルームが利用できます。「チーム」タブから作成・参加してください。
        </Text>
      </Card>
    )
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? null

  if (selectedTeam) {
    return (
      <RoomView
        team={selectedTeam}
        currentUserId={user?.id}
        onBack={() => setSelectedTeamId(null)}
        onLeft={() => {
          setSelectedTeamId(null)
          void refreshProfile()
        }}
      />
    )
  }

  return (
    <VStack align="stretch" spacing={4}>
      <Box>
        <Heading size="lg" letterSpacing="tight">
          トーク
        </Heading>
        <Text color="gray.600" mt={1}>
          トークルームを選ぶと、チームのメンバーとリアルタイムにやり取りできます。
        </Text>
      </Box>
      <RoomList teams={teams} onSelect={setSelectedTeamId} />
    </VStack>
  )
}
