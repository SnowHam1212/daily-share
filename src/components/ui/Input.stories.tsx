import type { Meta, StoryObj } from '@storybook/react'
import { Input } from './Input'

const meta = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { label: 'メールアドレス', placeholder: 'example@email.com', id: 'email' },
}

export const WithError: Story = {
  args: {
    label: 'パスワード',
    type: 'password',
    placeholder: 'パスワードを入力',
    id: 'password',
    errorMessage: 'パスワードは8文字以上で入力してください',
  },
}

export const NoLabel: Story = {
  args: { placeholder: 'ラベルなし' },
}
