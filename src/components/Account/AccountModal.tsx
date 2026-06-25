import { useState } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  FormControl,
  FormLabel,
  HStack,
  VStack,
  Avatar,
  Box,
  Text,
  Divider,
  useToast,
} from '@chakra-ui/react'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { LegalModal, type LegalDoc } from '../Legal/LegalModal'

interface AccountModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: number
}

export function AccountModal({ isOpen, onClose, initialTab = 0 }: AccountModalProps) {
  const { user, profile, updateProfile, refreshProfile, signOut, deleteAccount } = useAuth()
  const toast = useToast()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null)

  async function handleDelete() {
    setDeleting(true)
    const { error } = await deleteAccount()
    setDeleting(false)
    if (error) {
      toast({ status: 'error', title: '削除できませんでした', description: error.message })
      return
    }
    // signOut 済み。AuthGuard がログイン画面へ戻す。
    onClose()
  }
  // Initialized from the current profile on mount. The parent mounts this only
  // while open, so each open starts fresh from the latest profile.
  const [tabIndex, setTabIndex] = useState(initialTab)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => ({
    displayName: profile?.displayName ?? '',
    familyName: profile?.familyName ?? '',
    firstName: profile?.firstName ?? '',
    phoneNumber: profile?.phoneNumber ?? '',
  }))

  const email = profile?.email ?? user?.email ?? ''
  const joinedAt = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—'

  async function handleSave() {
    if (!user) return
    if (!form.displayName.trim()) {
      toast({ status: 'warning', title: '表示名を入力してください' })
      return
    }
    setSaving(true)
    const { error } = await updateProfile(user.id, {
      displayName: form.displayName.trim(),
      familyName: form.familyName.trim() || null,
      firstName: form.firstName.trim() || null,
      phoneNumber: form.phoneNumber.trim() || null,
    })
    setSaving(false)
    if (error) {
      toast({ status: 'error', title: '保存できませんでした', description: error.message })
      return
    }
    await refreshProfile()
    toast({ status: 'success', title: 'プロフィールを更新しました' })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
      <ModalOverlay bg="blackAlpha.500" backdropFilter="blur(2px)" />
      <ModalContent mx={4}>
        <ModalHeader fontFamily="heading">アカウント</ModalHeader>
        <ModalCloseButton borderRadius="full" />
        <ModalBody>
          {/* Account summary */}
          <HStack spacing={3} mb={4}>
            <Avatar size="md" name={form.displayName || email} bg="primary.500" color="white" />
            <Box minW={0}>
              <Text fontWeight="700" color="gray.900" noOfLines={1}>
                {form.displayName || '名称未設定'}
              </Text>
              <Text fontSize="sm" color="gray.500" noOfLines={1}>
                {email}
              </Text>
            </Box>
          </HStack>

          <Tabs index={tabIndex} onChange={setTabIndex} variant="unstyled">
            <TabList gap={1} bg="gray.100" p={1} borderRadius="lg" mb={4}>
              {['プロフィール', '設定'].map((label) => (
                <Tab
                  key={label}
                  flex={1}
                  borderRadius="md"
                  fontSize="sm"
                  fontWeight="semibold"
                  color="gray.500"
                  _selected={{ bg: 'paper-2', color: 'primary.700', boxShadow: 'sm' }}
                >
                  {label}
                </Tab>
              ))}
            </TabList>

            <TabPanels>
              {/* Profile editing */}
              <TabPanel p={0}>
                <VStack spacing={4} align="stretch">
                  <FormControl isRequired>
                    <FormLabel>表示名</FormLabel>
                    <Input
                      value={form.displayName}
                      placeholder="例: 山田 太郎"
                      onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    />
                  </FormControl>
                  <HStack spacing={3} align="start">
                    <FormControl>
                      <FormLabel>姓</FormLabel>
                      <Input
                        value={form.familyName}
                        onChange={(e) => setForm({ ...form, familyName: e.target.value })}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>名</FormLabel>
                      <Input
                        value={form.firstName}
                        onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      />
                    </FormControl>
                  </HStack>
                  <FormControl>
                    <FormLabel>電話番号</FormLabel>
                    <Input
                      type="tel"
                      value={form.phoneNumber}
                      placeholder="任意"
                      onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                    />
                  </FormControl>
                </VStack>
              </TabPanel>

              {/* Account info + sign out */}
              <TabPanel p={0}>
                <VStack spacing={3} align="stretch">
                  <Box>
                    <Text fontSize="xs" fontWeight="semibold" color="gray.500">
                      メールアドレス
                    </Text>
                    <Text color="gray.800">{email}</Text>
                  </Box>
                  <Divider borderColor="gray.200" />
                  <Box>
                    <Text fontSize="xs" fontWeight="semibold" color="gray.500">
                      登録日
                    </Text>
                    <Text color="gray.800">{joinedAt}</Text>
                  </Box>
                  <Divider borderColor="gray.200" />
                  <Button
                    variant="secondary"
                    color="danger.600"
                    onClick={() => {
                      onClose()
                      void signOut()
                    }}
                  >
                    ログアウト
                  </Button>

                  <Divider borderColor="gray.200" />

                  <HStack spacing={4} fontSize="sm">
                    <Box as="span" color="primary.600" cursor="pointer" onClick={() => setLegalDoc('terms')}>
                      利用規約
                    </Box>
                    <Box as="span" color="primary.600" cursor="pointer" onClick={() => setLegalDoc('privacy')}>
                      プライバシーポリシー
                    </Box>
                  </HStack>

                  <Divider borderColor="gray.200" />

                  {/* Danger zone — irreversible account deletion */}
                  <Box bg="danger.50" border="1px solid" borderColor="danger.200" borderRadius="lg" p={3}>
                    <Text fontSize="sm" fontWeight="700" color="danger.700" mb={1}>
                      アカウントを削除
                    </Text>
                    <Text fontSize="xs" color="danger.700" mb={3}>
                      アカウントと、予定・位置・フレンド・チームのメンバー情報・チャットなど、
                      あなたに紐づくデータがすべて完全に削除されます。この操作は取り消せません。
                    </Text>
                    {confirmingDelete ? (
                      <HStack>
                        <Button
                          size="sm"
                          variant="signal"
                          bg="danger.600"
                          _hover={{ bg: 'danger.700' }}
                          isLoading={deleting}
                          loadingText="削除中"
                          onClick={handleDelete}
                        >
                          本当に削除する
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                          やめる
                        </Button>
                      </HStack>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        color="danger.600"
                        borderColor="danger.300"
                        onClick={() => setConfirmingDelete(true)}
                      >
                        アカウントを削除する
                      </Button>
                    )}
                  </Box>
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>

        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose}>
            閉じる
          </Button>
          {tabIndex === 0 && (
            <Button variant="primary" onClick={handleSave} isLoading={saving} loadingText="保存中">
              保存する
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </Modal>
  )
}
