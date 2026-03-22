import type { Meta, StoryObj } from '@storybook/react-vite'
import { Text } from '@chakra-ui/react'
import { Card } from './Card'

const meta = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: <Text>カードのコンテンツがここに入ります。</Text>,
  },
}

export const Compact: Story = {
  args: {
    p: 4,
    children: <Text fontSize="sm">コンパクトなカード</Text>,
  },
}
