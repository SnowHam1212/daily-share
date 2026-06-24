import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
}

/**
 * "Cartograph" design system.
 *
 * Daily Share is about sharing where you are and what your days hold, so the
 * visual language borrows from maps and field notebooks: paper surfaces, ink
 * text, an ocean-teal brand, and a single coral "signal" reserved for live
 * presence and the moments that matter most (today, now, primary actions).
 */
const theme = extendTheme({
  config,
  colors: {
    // Brand — ocean teal (the "water" of a map)
    primary: {
      50: '#eafaf7',
      100: '#cbf0e9',
      200: '#9ce0d5',
      300: '#5fc9ba',
      400: '#2dad9c',
      500: '#0f9384',
      600: '#0b766b',
      700: '#0c5e56',
      800: '#0d4b46',
      900: '#0a3e3a',
    },
    // Signal — coral, the "you are here" / live / now accent. Use sparingly.
    signal: {
      50: '#fff2ee',
      100: '#ffe0d6',
      200: '#ffc2ad',
      300: '#ff9b78',
      400: '#ff6f43',
      500: '#f5501f',
      600: '#d63d10',
      700: '#b22f0d',
      800: '#8f2810',
      900: '#752411',
    },
    // Neutrals — warm ink on paper (overrides Chakra's cool grays)
    gray: {
      50: '#f8f7f4',
      100: '#efede8',
      200: '#e0ddd5',
      300: '#c8c4b8',
      400: '#a39e90',
      500: '#7c776a',
      600: '#5c584e',
      700: '#423f38',
      800: '#2a2823',
      900: '#1a1916',
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
    paper: '#f8f7f4',
    'paper-2': '#fffefb',
  },
  fonts: {
    body: "'Inter', 'Noto Sans JP', system-ui, 'Segoe UI', Roboto, sans-serif",
    heading: "'Space Grotesk', 'Noto Sans JP', system-ui, sans-serif",
    mono: "'Space Mono', ui-monospace, Consolas, monospace",
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
    '5xl': '3rem',
  },
  letterSpacings: {
    tighter: '-0.04em',
    tight: '-0.02em',
    normal: '0',
    wide: '0.04em',
    wider: '0.12em',
  },
  radii: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(26, 25, 22, 0.06)',
    md: '0 2px 4px -1px rgba(26, 25, 22, 0.06), 0 6px 16px -4px rgba(26, 25, 22, 0.08)',
    lg: '0 8px 24px -6px rgba(26, 25, 22, 0.12), 0 2px 6px -2px rgba(26, 25, 22, 0.06)',
    focus: '0 0 0 3px rgba(15, 147, 132, 0.25)',
  },
  styles: {
    global: {
      'html, body': {
        bg: 'paper',
        color: 'gray.900',
      },
      '::selection': {
        bg: 'primary.100',
        color: 'primary.800',
      },
    },
  },
  components: {
    Heading: {
      baseStyle: {
        fontFamily: 'heading',
        letterSpacing: 'tight',
        color: 'gray.900',
      },
    },
    Button: {
      baseStyle: {
        fontWeight: 'semibold',
        borderRadius: 'lg',
        letterSpacing: '-0.01em',
        transitionProperty: 'common',
        transitionDuration: '150ms',
        _focusVisible: { boxShadow: 'focus' },
      },
      sizes: {
        sm: { h: 9, minW: 9, fontSize: 'sm', px: 4 },
        md: { h: 11, minW: 11, fontSize: 'md', px: 6 },
        lg: { h: 13, minW: 13, fontSize: 'lg', px: 8 },
      },
      variants: {
        // Brand action — ocean teal
        primary: {
          bg: 'primary.500',
          color: 'white',
          _hover: { bg: 'primary.600', _disabled: { bg: 'primary.500' } },
          _active: { bg: 'primary.700' },
        },
        // The single high-energy accent — reserve for the page's main CTA
        signal: {
          bg: 'signal.500',
          color: 'white',
          _hover: { bg: 'signal.600', _disabled: { bg: 'signal.500' } },
          _active: { bg: 'signal.700' },
        },
        secondary: {
          bg: 'paper',
          color: 'gray.800',
          border: '1px solid',
          borderColor: 'gray.300',
          _hover: { bg: 'gray.100', borderColor: 'gray.400' },
          _active: { bg: 'gray.200' },
        },
        ghost: {
          bg: 'transparent',
          color: 'gray.700',
          _hover: { bg: 'gray.100' },
          _active: { bg: 'gray.200' },
        },
      },
      defaultProps: {
        variant: 'primary',
      },
    },
    Input: {
      baseStyle: {
        field: { borderRadius: 'lg' },
      },
      variants: {
        outline: {
          field: {
            bg: 'paper',
            borderColor: 'gray.300',
            _hover: { borderColor: 'gray.400' },
            _focusVisible: {
              borderColor: 'primary.500',
              boxShadow: 'focus',
            },
          },
        },
      },
      defaultProps: {
        variant: 'outline',
      },
    },
    Textarea: {
      variants: {
        outline: {
          bg: 'paper',
          borderRadius: 'lg',
          borderColor: 'gray.300',
          _hover: { borderColor: 'gray.400' },
          _focusVisible: { borderColor: 'primary.500', boxShadow: 'focus' },
        },
      },
    },
    Select: {
      variants: {
        outline: {
          field: {
            bg: 'paper',
            borderRadius: 'lg',
            borderColor: 'gray.300',
            _hover: { borderColor: 'gray.400' },
            _focusVisible: { borderColor: 'primary.500', boxShadow: 'focus' },
          },
        },
      },
    },
    FormLabel: {
      baseStyle: {
        fontSize: 'sm',
        fontWeight: 'semibold',
        color: 'gray.700',
        mb: 1.5,
      },
    },
    Modal: {
      baseStyle: {
        dialog: { borderRadius: '2xl', bg: 'paper' },
      },
    },
  },
})

export default theme
