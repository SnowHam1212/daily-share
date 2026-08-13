import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  Box,
  HStack,
  VStack,
  Text,
  Avatar,
  Badge,
  IconButton,
  Spinner,
  Center,
  Divider,
  useClipboard,
  useToast,
} from '@chakra-ui/react'
import { CopyIcon, CloseIcon, AddIcon } from '@chakra-ui/icons'
import { supabase } from '../../lib/supabase'
import { fetchPublicProfiles } from '../../lib/profiles'
import type { useTeamMembers } from '../../hooks/useTeamMembers'
import { Button } from '../ui/Button'

type Friend = { id: string; displayName: string }

/** 誰がメンバーを退出させられるか（teams."removalPolicy"）。 */
const REMOVAL_POLICY_LABEL: Record<string, string> = {
  admin_only: '管理者のみがメンバーを退出させられます',
  anyone: 'メンバーなら誰でも他のメンバーを退出させられます',
  nobody: 'このルームでは誰もメンバーを退出させられません',
}

/** 確認ダイアログの対象。null なら閉じている。 */
type Confirm =
  | { kind: 'remove'; userId: string; name: string }
  | { kind: 'leave' }
  | null

interface RoomMembersModalProps {
  isOpen: boolean
  onClose: () => void
  teamName: string
  invitationalCode: string
  removalPolicy: string
  currentUserId: string | undefined
  /** RoomView が持つ useTeamMembers の戻り値。二重取得を避けるため共有する。 */
  team: ReturnType<typeof useTeamMembers>
  /** 自分が退出したあとに呼ぶ（親でルーム一覧へ戻す）。 */
  onLeft: () => void
}

export function RoomMembersModal({
  isOpen,
  onClose,
  teamName,
  invitationalCode,
  removalPolicy,
  currentUserId,
  team,
  onLeft,
}: RoomMembersModalProps) {
  const { members, invitations, loading, inviteMember, cancelInvitation, removeMember, leaveTeam } =
    team
  const toast = useToast()
  const { hasCopied, onCopy } = useClipboard(invitationalCode)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [confirming, setConfirming] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const cancelRef = useRef<HTMLButtonElement>(null)

  const isAdmin = useMemo(
    () => members.some((m) => m.userId === currentUserId && m.role === 'admin'),
    [members, currentUserId],
  )
  // 退出させるボタンを出すかどうか。方針と自分のロールで決まる。
  const canRemove =
    removalPolicy === 'anyone' || (removalPolicy === 'admin_only' && isAdmin)

  // 招待候補にするため、自分の友だちを取得する。
  const loadFriends = useCallback(async () => {
    if (!currentUserId) return
    const { data: rows } = await supabase
      .from('user_friends')
      .select('friendId')
      .eq('userId', currentUserId)
    const ids = (rows ?? []).map((r) => r.friendId)
    if (ids.length === 0) return setFriends([])
    // 他人の表示名は公開情報の RPC から引く（0018）。
    const names = await fetchPublicProfiles(ids)
    setFriends(ids.map((id) => ({ id, displayName: names.get(id) ?? '不明なユーザー' })))
  }, [currentUserId])

  useEffect(() => {
    if (isOpen) void loadFriends()
  }, [isOpen, loadFriends])

  // すでにメンバー、または招待済みの友だちは候補から除く。
  const invitableFriends = useMemo(() => {
    const taken = new Set([
      ...members.map((m) => m.userId),
      ...invitations.map((i) => i.inviteeId),
    ])
    return friends.filter((f) => !taken.has(f.id))
  }, [friends, members, invitations])

  async function handleInvite(friend: Friend) {
    setBusyId(friend.id)
    try {
      const { error } = await inviteMember(friend.id)
      if (error) {
        toast({ status: 'error', title: '招待できませんでした', description: error })
        return
      }
      toast({
        status: 'success',
        title: `${friend.displayName} を招待しました`,
        description: '相手が承諾するとルームに参加します。',
      })
    } finally {
      setBusyId(null)
    }
  }

  async function handleCancelInvitation(invitationId: string, name: string) {
    setBusyId(invitationId)
    try {
      const { error } = await cancelInvitation(invitationId)
      if (error) {
        toast({ status: 'error', title: '取り消せませんでした', description: error })
        return
      }
      toast({ status: 'info', title: `${name} への招待を取り消しました` })
    } finally {
      setBusyId(null)
    }
  }

  // 破壊的操作は確認ダイアログを挟んでから実行する。
  async function runConfirmed() {
    if (!confirm) return
    setConfirming(true)
    try {
      if (confirm.kind === 'remove') {
        const { error } = await removeMember(confirm.userId)
        if (error) {
          toast({ status: 'error', title: '退出させられませんでした', description: error })
          return
        }
        toast({ status: 'success', title: `${confirm.name} を退出させました` })
      } else {
        const { error } = await leaveTeam()
        if (error) {
          toast({ status: 'error', title: '退出できませんでした', description: error })
          return
        }
        toast({ status: 'success', title: `「${teamName}」から退出しました` })
        onClose()
        onLeft()
      }
    } finally {
      setConfirming(false)
      setConfirm(null)
    }
  }

  const confirmCopy =
    confirm?.kind === 'remove'
      ? {
          title: 'メンバーを退出させる',
          body: `${confirm.name} を「${teamName}」から退出させます。相手はこのルームのメッセージを読めなくなります。よろしいですか？`,
          action: '退出させる',
        }
      : {
          title: 'ルームを退出',
          body: `「${teamName}」から退出します。以降このルームのメッセージは読めなくなります。よろしいですか？`,
          action: '退出する',
        }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} isCentered scrollBehavior="inside">
        <ModalOverlay bg="blackAlpha.500" backdropFilter="blur(2px)" />
        <ModalContent mx={4}>
          <ModalHeader fontFamily="heading">メンバー管理</ModalHeader>
          <ModalCloseButton borderRadius="full" />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <Box>
                <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="wide" mb={1}>
                  招待コード
                </Text>
                <HStack spacing={2}>
                  <Box
                    fontFamily="mono"
                    fontSize="sm"
                    fontWeight="700"
                    bg="gray.100"
                    px={2}
                    py={1}
                    borderRadius="md"
                    letterSpacing="wide"
                  >
                    {invitationalCode}
                  </Box>
                  <IconButton
                    aria-label="招待コードをコピー"
                    icon={<CopyIcon />}
                    size="sm"
                    variant="ghost"
                    onClick={onCopy}
                  />
                  {hasCopied && (
                    <Text fontSize="xs" color="signal.600">
                      コピーしました
                    </Text>
                  )}
                </HStack>
                <Text fontSize="xs" color="gray.400" mt={1}>
                  {REMOVAL_POLICY_LABEL[removalPolicy] ?? REMOVAL_POLICY_LABEL.admin_only}
                </Text>
              </Box>

              <Divider />

              <Box>
                <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="wide" mb={2}>
                  メンバー（{members.length}）
                </Text>
                {loading ? (
                  <Center py={4}>
                    <Spinner size="sm" color="primary.500" />
                  </Center>
                ) : (
                  <VStack align="stretch" spacing={2}>
                    {members.map((m) => {
                      const isMe = m.userId === currentUserId
                      // 管理者を退出させられるのは管理者だけ（RPC 側でも弾く）。
                      const removable = canRemove && !isMe && (m.role !== 'admin' || isAdmin)
                      return (
                        <HStack key={m.userId} spacing={3}>
                          <Avatar size="sm" name={m.displayName} bg="primary.500" color="white" />
                          <Box flex={1} minW={0}>
                            <Text fontSize="sm" color="gray.800" noOfLines={1}>
                              {m.displayName}
                              {isMe && (
                                <Text as="span" color="gray.400">
                                  {' '}
                                  (あなた)
                                </Text>
                              )}
                            </Text>
                          </Box>
                          {m.role === 'admin' && (
                            <Badge colorScheme="purple" fontSize="10px">
                              管理者
                            </Badge>
                          )}
                          {removable && (
                            <IconButton
                              aria-label={`${m.displayName} を退出させる`}
                              icon={<CloseIcon boxSize={2.5} />}
                              size="xs"
                              variant="ghost"
                              colorScheme="danger"
                              isLoading={busyId === m.userId}
                              onClick={() =>
                                setConfirm({
                                  kind: 'remove',
                                  userId: m.userId,
                                  name: m.displayName,
                                })
                              }
                            />
                          )}
                        </HStack>
                      )
                    })}
                  </VStack>
                )}
              </Box>

              {invitations.length > 0 && (
                <>
                  <Divider />
                  <Box>
                    <Text
                      fontSize="xs"
                      fontWeight="bold"
                      color="gray.500"
                      letterSpacing="wide"
                      mb={2}
                    >
                      招待中（{invitations.length}）
                    </Text>
                    <VStack align="stretch" spacing={2}>
                      {invitations.map((inv) => (
                        <HStack key={inv.invitationId} spacing={3}>
                          <Avatar size="sm" name={inv.inviteeName} bg="gray.300" color="white" />
                          <Box flex={1} minW={0}>
                            <Text fontSize="sm" color="gray.800" noOfLines={1}>
                              {inv.inviteeName}
                            </Text>
                            <Text fontSize="xs" color="gray.400">
                              承諾待ち
                            </Text>
                          </Box>
                          <Button
                            size="xs"
                            variant="ghost"
                            isLoading={busyId === inv.invitationId}
                            onClick={() =>
                              handleCancelInvitation(inv.invitationId, inv.inviteeName)
                            }
                          >
                            取り消す
                          </Button>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
                </>
              )}

              <Divider />

              <Box>
                <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="wide" mb={2}>
                  友だちを招待
                </Text>
                {invitableFriends.length === 0 ? (
                  <Text fontSize="sm" color="gray.400">
                    招待できる友だちがいません。「フレンド」タブで友だちを増やせます。
                  </Text>
                ) : (
                  <VStack align="stretch" spacing={2}>
                    {invitableFriends.map((f) => (
                      <HStack key={f.id} spacing={3}>
                        <Avatar size="sm" name={f.displayName} bg="gray.400" color="white" />
                        <Text fontSize="sm" color="gray.800" flex={1} minW={0} noOfLines={1}>
                          {f.displayName}
                        </Text>
                        <Button
                          size="xs"
                          variant="signal"
                          leftIcon={<AddIcon boxSize={2.5} />}
                          isLoading={busyId === f.id}
                          onClick={() => handleInvite(f)}
                        >
                          招待
                        </Button>
                      </HStack>
                    ))}
                  </VStack>
                )}
              </Box>
            </VStack>
          </ModalBody>

          <ModalFooter gap={2}>
            <Button variant="secondary" colorScheme="danger" onClick={() => setConfirm({ kind: 'leave' })}>
              このルームを退出
            </Button>
            <Button variant="ghost" onClick={onClose}>
              閉じる
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog
        isOpen={confirm !== null}
        leastDestructiveRef={cancelRef}
        onClose={() => setConfirm(null)}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent mx={4}>
            <AlertDialogHeader fontFamily="heading" fontSize="lg">
              {confirmCopy.title}
            </AlertDialogHeader>
            <AlertDialogBody fontSize="sm" color="gray.700">
              {confirmCopy.body}
            </AlertDialogBody>
            <AlertDialogFooter gap={2}>
              <Button ref={cancelRef} variant="ghost" onClick={() => setConfirm(null)}>
                キャンセル
              </Button>
              <Button colorScheme="danger" isLoading={confirming} onClick={() => void runConfirmed()}>
                {confirmCopy.action}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  )
}
