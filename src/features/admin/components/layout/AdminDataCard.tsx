import type { ReactNode } from 'react'

type Props = {
  title?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export default function AdminDataCard({ title, actions, children, className }: Props) {
  const rootClass = ['admin-data-card', className].filter(Boolean).join(' ')

  return (
    <section className={rootClass}>
      {title || actions ? (
        <div className="admin-data-card__head">
          {title ? <h2 className="admin-data-card__title">{title}</h2> : <div />}
          {actions ? <div className="admin-data-card__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}
