import type { ReactNode } from 'react'

export type UserPageHeaderProps = {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}

export default function UserPageHeader({ title, subtitle, actions, className = '' }: UserPageHeaderProps) {
  return (
    <header className={['user-page__header', className].filter(Boolean).join(' ')}>
      <div className="user-page__header-main">
        <h1 className="user-page__title">{title}</h1>
        {subtitle ? <p className="user-page__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="user-page__header-actions">{actions}</div> : null}
    </header>
  )
}
