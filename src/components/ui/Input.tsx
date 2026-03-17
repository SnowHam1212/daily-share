import {
  FormControl,
  FormLabel,
  FormErrorMessage,
  Input as ChakraInput,
  type InputProps as ChakraInputProps,
} from '@chakra-ui/react'

interface InputProps extends ChakraInputProps {
  label?: string
  errorMessage?: string
}

export function Input({ label, errorMessage, id, ...props }: InputProps) {
  const isInvalid = Boolean(errorMessage)
  return (
    <FormControl isInvalid={isInvalid}>
      {label && <FormLabel htmlFor={id}>{label}</FormLabel>}
      <ChakraInput id={id} {...props} />
      {isInvalid && <FormErrorMessage>{errorMessage}</FormErrorMessage>}
    </FormControl>
  )
}
