import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
}

const theme = extendTheme({
  config,
  colors: {
    primary: {
      50: '#f5f0ff',
      100: '#ede0ff',
      200: '#d9bdff',
      300: '#c084fc',
      400: '#aa3bff',
      500: '#9333ea',
      600: '#7c3aed',
      700: '#6d28d9',
      800: '#5b21b6',
      900: '#4c1d95',
    },
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    danger: {
      50: '#fff1f2',
      100: '#ffe4e6',
      200: '#fecdd3',
      300: '#fda4af',
      400: '#fb7185',
      500: '#f43f5e',
      600: '#e11d48',
      700: '#be123c',
      800: '#9f1239',
      900: '#881337',
    },
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
  },
  fonts: {
    body: "system-ui, 'Segoe UI', Roboto, sans-serif",
    heading: "system-ui, 'Segoe UI', Roboto, sans-serif",
    mono: 'ui-monospace, Consolas, monospace',
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
  space: {
    px: '1px',
    0.5: '0.125rem',
    1: '0.25rem',
    1.5: '0.375rem',
    2: '0.5rem',
    2.5: '0.625rem',
    3: '0.75rem',
    3.5: '0.875rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
  },
  radii: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 'medium',
        borderRadius: 'md',
      },
      variants: {
        primary: {
          bg: 'primary.400',
          color: 'white',
          _hover: { bg: 'primary.500' },
          _active: { bg: 'primary.600' },
        },
        secondary: {
          bg: 'white',
          color: 'gray.700',
          border: '1px solid',
          borderColor: 'gray.200',
          _hover: { bg: 'gray.50' },
          _active: { bg: 'gray.100' },
        },
        ghost: {
          bg: 'transparent',
          color: 'primary.500',
          _hover: { bg: 'primary.50' },
          _active: { bg: 'primary.100' },
        },
      },
      defaultProps: {
        variant: 'primary',
      },
    },
    Input: {
      variants: {
        outline: {
          field: {
            borderColor: 'gray.200',
            borderRadius: 'md',
            _hover: { borderColor: 'primary.300' },
            _focus: { borderColor: 'primary.400', boxShadow: '0 0 0 1px var(--chakra-colors-primary-400)' },
          },
        },
      },
      defaultProps: {
        variant: 'outline',
      },
    },
  },
})

export default theme
