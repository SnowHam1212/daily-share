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
    
    // バリデーション
    if (!displayName.trim()) {
      setError('表示名を入力してください')
      return
    }

    // 電話番号のバリデーション（空白のみ、またはスペース除外後に空文字列なら null）
    const trimmedPhone = phoneNumber.trim()
    const validPhone = trimmedPhone === '' ? null : trimmedPhone

    // 誕生日のバリデーション
    const validBirthday: string | null = birthday || null
    if (validBirthday) {
      const birthDate = new Date(validBirthday)
      const today = new Date()
      
      // 未来の日付チェック
      if (birthDate > today) {
        setError('生年月日は今日より前の日付を設定してください')
        return
      }

      // 年齢チェック（0歳〜150歳の範囲）
      const age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
        ? age - 1 
        : age

      if (actualAge < 0 || actualAge > 150) {
        setError('有効な生年月日を入力してください')
        return
      }
    }

    setIsLoading(true)
    const result = await updateProfile(user.id, {
      displayName: displayName.trim(),
      familyName: familyName.trim() || null,
      firstName: firstName.trim() || null,
      phoneNumber: validPhone,
      birthday: validBirthday,
    })
    setIsLoading(false)
    if (result.error) {
      setError(result.error.message)
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
