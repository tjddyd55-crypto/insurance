import type { ReactNode } from 'react'

type Props = {
  label?: string
  htmlFor?: string
  children: ReactNode
}

export function FormField({ label, htmlFor, children }: Props) {
  return (
    <div className="cs-form-primitive__field">
      {label ? (
        <label className="cs-form-primitive__label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      {children}
    </div>
  )
}
