import { Button as ChakraButton, type ButtonProps as ChakraButtonProps } from '@chakra-ui/react'

type Variant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends Omit<ChakraButtonProps, 'variant'> {
  variant?: Variant
}

export function Button({ variant = 'primary', ...props }: ButtonProps) {
  return <ChakraButton variant={variant} {...props} />
}
