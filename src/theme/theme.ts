import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
}

/**
 * "Compass" design system (v2) — generated with UI/UX Pro Max.
 *
 * Daily Share is a team-collaboration utility (shared location, calendar,
 * teams), so the visual language follows a clean Flat Design language tuned for
 * dashboards: a calm indigo brand for trust and focus, a warm amber "signal"
 * reserved for live presence and the moments that matter most (you-are-here,
 * today, now, primary actions), cool slate neutrals, and Plus Jakarta Sans for
 * a friendly, modern, productivity-app feel.
 */
const theme = extendTheme({
  config,
  colors: {
    // Brand — calm indigo (trust + focus, ideal for collaboration tools)
    primary: {
      50: '#eef2ff',
      100: '#e0e7ff',
      200: '#c7d2fe',
      300: '#a5b4fc',
      400: '#818cf8',
      500: '#6366f1',
      600: '#4f46e5',
      700: '#4338ca',
      800: '#3730a3',
      900: '#312e81',
    },
    // Signal — warm amber, the "you are here" / live / now accent. Use sparingly.
    signal: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
    },
    // Neutrals — cool slate (clean, modern flat-design grays)
    gray: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
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
    // Success — emerald (the collaboration palette's success green)
    success: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
    },
    paper: '#f6f7fb',
    'paper-2': '#ffffff',
  },
  fonts: {
    body: "'Plus Jakarta Sans', 'Noto Sans JP', system-ui, 'Segoe UI', Roboto, sans-serif",
    heading: "'Plus Jakarta Sans', 'Noto Sans JP', system-ui, sans-serif",
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
    // Flat design: minimal, soft elevation with a cool slate tint
    sm: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
    md: '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 4px 12px -2px rgba(15, 23, 42, 0.06)',
    lg: '0 4px 16px -4px rgba(15, 23, 42, 0.10), 0 2px 6px -2px rgba(15, 23, 42, 0.05)',
    focus: '0 0 0 3px rgba(99, 102, 241, 0.30)',
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
        // Never let a button shrink or wrap its label in tight flex rows —
        // it should always size to fit its text.
        whiteSpace: 'nowrap',
        flexShrink: 0,
        _focusVisible: { boxShadow: 'focus' },
      },
      sizes: {
        // NOTE: use rem strings, not 9/11/13 — those keys don't exist in
        // Chakra's spacing scale (…8,10,12,14…), so `h: 11` renders as 11px.
        sm: { h: '2.25rem', minW: '2.25rem', fontSize: 'sm', px: 4 },
        md: { h: '2.75rem', minW: '2.75rem', fontSize: 'md', px: 6 },
        lg: { h: '3.25rem', minW: '3.25rem', fontSize: 'lg', px: 8 },
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
