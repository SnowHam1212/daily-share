import type { Preview } from '@storybook/react-vite'
import { ChakraProvider } from '@chakra-ui/react'
import theme from '../src/theme/theme'

const preview: Preview = {
  decorators: [
    (Story) => (
      <ChakraProvider theme={theme}>
        <Story />
      </ChakraProvider>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
  },
}

export default preview
