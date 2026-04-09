import { useState } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  VStack,
  Text,
  Box,
  SimpleGrid,
} from '@chakra-ui/react'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface ProfileSetupModalProps {
  isOpen: boolean
  onComplete: () => void
}

export function ProfileSetupModal({ isOpen, onComplete }: ProfileSetupModalProps) {
  const { user, updateProfile } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [birthday, setBirthday] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setError(null)
    setIsLoading(true)
    const { error } = await updateProfile(user.id, {
      displayName,
      familyName: familyName || null,
      firstName: firstName || null,
      phoneNumber: phoneNumber || null,
      birthday: birthday || null,
    })
    setIsLoading(false)
    if (error) {
      setError(error.message)
    } else {
      onComplete()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      closeOnOverlayClick={false}
      closeOnEsc={false}
      isCentered
    >
      <ModalOverlay />
      <ModalContent mx={4}>
        <ModalHeader>
          <Text fontSize="xl" fontWeight="medium">プロフィール設定</Text>
          <Text fontSize="sm" color="gray.500" fontWeight="normal" mt={1}>
            アカウント情報を入力してください
          </Text>
        </ModalHeader>

        <ModalBody>
          <VStack as="form" id="profile-form" onSubmit={handleSubmit} spacing={4} align="stretch">
            {error && (
              <Box
                bg="danger.50"
                border="1px solid"
                borderColor="danger.200"
                borderRadius="md"
                px={3}
                py={2}
              >
                <Text fontSize="sm" color="danger.600">{error}</Text>
              </Box>
            )}

            <Input
              label="表示名 *"
              id="displayName"
              type="text"
              placeholder="アプリ内で表示される名前"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />

            <SimpleGrid columns={2} spacing={3}>
              <Input
                label="姓"
                id="familyName"
                type="text"
                placeholder="山田"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
              />
              <Input
                label="名"
                id="firstName"
                type="text"
                placeholder="太郎"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </SimpleGrid>

            <Input
              label="電話番号"
              id="phoneNumber"
              type="tel"
              placeholder="090-0000-0000"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />

            <Input
              label="生年月日"
              id="birthday"
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button
            type="submit"
            form="profile-form"
            isLoading={isLoading}
            isDisabled={displayName.trim() === ''}
            w="full"
          >
            始める
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
