import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@chakra-ui/react'

// MapPin は Leaflet DivIcon を返す関数なので SVG を直接プレビューする
function MapPinPreview({ color }: { color?: string }) {
  const PIN_COLOR = color ?? '#aa3bff'
  return (
    <Box display="inline-block">
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
        <path
          d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z"
          fill={PIN_COLOR}
        />
        <circle cx="14" cy="14" r="5" fill="white" />
      </svg>
    </Box>
  )
}

const meta = {
  title: 'Map/MapPin',
  component: MapPinPreview,
  tags: ['autodocs'],
  argTypes: {
    color: { control: 'color' },
  },
} satisfies Meta<typeof MapPinPreview>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Custom: Story = {
  args: { color: '#22c55e' },
}
