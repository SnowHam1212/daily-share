import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Heading,
  Text,
  VStack,
  Box,
} from '@chakra-ui/react'
import { Button } from '../ui/Button'

export type LegalDoc = 'privacy' | 'terms'

// NOTE: これは雛形です。実際の公開前に必ず弁護士のレビューを受け、運営者情報・
// 連絡先・準拠法などを自社の実態に合わせて差し替えてください。
const LAST_UPDATED = '2026-06-25'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Heading size="sm" mb={1}>
        {title}
      </Heading>
      <Text fontSize="sm" color="gray.700" whiteSpace="pre-wrap">
        {children}
      </Text>
    </Box>
  )
}

function Privacy() {
  return (
    <VStack align="stretch" spacing={4}>
      <Text fontSize="xs" color="gray.500">最終更新日: {LAST_UPDATED}（雛形・要法務確認）</Text>
      <Section title="1. 取得する情報">
        メールアドレス、表示名などのプロフィール情報、ならびに利用者が共有を選択した場合の位置情報（緯度・経度）、作成した予定、チャットの内容、チーム・フレンドの関係情報を取得します。
      </Section>
      <Section title="2. 位置情報の取り扱い">
        位置情報は、利用者が「共有範囲」を選択して明示的に共有した場合にのみ保存・共有されます。共有範囲（自分のみ／友だち／チーム）に応じて閲覧できる相手が制限されます。共有を停止すると以後の共有は行われません。
      </Section>
      <Section title="3. 利用目的">
        本サービスの提供（位置・予定の共有、チャット、チーム/フレンド機能）、不正利用の防止、サービス改善のために利用します。
      </Section>
      <Section title="4. 第三者提供">
        法令に基づく場合を除き、利用者の同意なく第三者へ個人情報を提供しません。インフラ提供者（Supabase 等）には処理の委託として必要な範囲で預託します。
      </Section>
      <Section title="5. 保存期間と削除">
        チャットメッセージは一定期間（既定 30 日）経過後に自動削除されます。利用者はアプリ内の「アカウントを削除」から、アカウントと関連データを完全に削除できます。
      </Section>
      <Section title="6. お問い合わせ">
        個人情報の開示・訂正・削除等のご請求は、運営者の連絡先（公開前に記載）までご連絡ください。
      </Section>
    </VStack>
  )
}

function Terms() {
  return (
    <VStack align="stretch" spacing={4}>
      <Text fontSize="xs" color="gray.500">最終更新日: {LAST_UPDATED}（雛形・要法務確認）</Text>
      <Section title="1. 適用">
        本規約は、本サービスの利用に関する条件を、利用者と運営者の間で定めるものです。
      </Section>
      <Section title="2. アカウント">
        利用者は正確な情報で登録し、認証情報を適切に管理する責任を負います。
      </Section>
      <Section title="3. 禁止事項">
        法令・公序良俗に反する行為、他者の権利侵害、なりすまし、位置情報の不正取得・悪用、スパム、サービスの運営を妨げる行為を禁止します。
      </Section>
      <Section title="4. 位置情報の共有">
        位置情報の共有は利用者自身の選択に基づきます。共有相手の範囲を理解した上でご利用ください。
      </Section>
      <Section title="5. 免責">
        運営者は、本サービスの中断・データの消失・利用者間のトラブル等について、法令で認められる範囲で責任を負いません。
      </Section>
      <Section title="6. 規約の変更">
        運営者は必要に応じて本規約を変更できます。重要な変更は適切な方法で周知します。
      </Section>
    </VStack>
  )
}

interface LegalModalProps {
  doc: LegalDoc | null
  onClose: () => void
}

export function LegalModal({ doc, onClose }: LegalModalProps) {
  return (
    <Modal isOpen={doc !== null} onClose={onClose} isCentered size="lg" scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.500" backdropFilter="blur(2px)" />
      <ModalContent mx={4}>
        <ModalHeader fontFamily="heading">
          {doc === 'terms' ? '利用規約' : 'プライバシーポリシー'}
        </ModalHeader>
        <ModalCloseButton borderRadius="full" />
        <ModalBody>{doc === 'terms' ? <Terms /> : <Privacy />}</ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            閉じる
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
