import { forwardRef } from 'react'
import { Button as ChakraButton, type ButtonProps as ChakraButtonProps } from '@chakra-ui/react'

type Variant = 'primary' | 'signal' | 'secondary' | 'ghost'

interface ButtonProps extends Omit<ChakraButtonProps, 'variant'> {
  variant?: Variant
}

// forwardRef so the component works correctly as a Chakra `as` target
// (Menu/Tooltip/Popover triggers need the ref to size and position).
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', ...props },
  ref,
) {
  return <ChakraButton ref={ref} variant={variant} {...props} />
})
