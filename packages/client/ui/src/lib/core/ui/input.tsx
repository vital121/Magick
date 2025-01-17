import * as React from 'react'

import { cn } from '../../utils/shadcn'

export const formInputStyles =
  'rounded-lg border-2 placeholder:font-montAlt border-ds-secondary bg-transparent py-2.5 h-11 px-3.5 text-ds-black dark:text-ds-white font-normal font-montAlt focus:outline-none focus:border-ds-primary'

export const agentInputStyles =
  'focus:border-secondary-highlight placeholder:font-montserrat font-montserrat placeholder:text-black/70 dark:placeholder:text-white/70 w-full p-2 bg-transparent border-2 border-[#808f9a] rounded-[8px] dark:text-white'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          `
          flex
          w-full
          rounded-sm
          border-[var(--deep-background-color)]
          border
          bg-[var(--background-color)]
          px-3
          my-2
          h-9
          text-sm
          shadow-sm
          transition-colors
          file:border-0
          file:bg-transparent
          file:text-sm
          file:font-medium
          focus-visible:outline-none
          focus-visible:ring-1
          focus-visible:ring-ring
          disabled:cursor-not-allowed
          disabled:opacity-50
          font-montserrat
        `,
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
