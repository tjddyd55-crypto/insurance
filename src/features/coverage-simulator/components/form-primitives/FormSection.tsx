import type { ReactNode } from 'react'

type Props = {
  title?: string
  children: ReactNode
}

export function FormSection({ title, children }: Props) {
  return (
    <section className="cs-form-primitive__section">
      {title ? <h2 className="cs-form-primitive__section-title">{title}</h2> : null}
      {children}
    </section>
  )
}
