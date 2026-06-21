import type { ReactNode } from 'react'
import type { AdminPageTab } from './adminPageLayout.types'

type Props = {
  title: string
  description?: string
  tabs?: readonly AdminPageTab[]
  activeTabId?: string
  onTabChange?: (tabId: string) => void
  className?: string
  children: ReactNode
}

export default function AdminPageShell({
  title,
  description,
  tabs,
  activeTabId,
  onTabChange,
  className,
  children,
}: Props) {
  const rootClass = ['page', 'page--with-back', 'admin-page-shell', className].filter(Boolean).join(' ')

  return (
    <main className={rootClass}>
      <div className="admin-page-shell__inner">
        <header className="page-header admin-page-shell__header">
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </header>

        {tabs?.length ? (
          <nav className="admin-page-shell__tabs billing-admin-tabs" aria-label={`${title} 탭`}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`billing-admin-tabs__btn${activeTabId === tab.id ? ' billing-admin-tabs__btn--active' : ''}`}
                onClick={() => onTabChange?.(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        ) : null}

        {children}
      </div>
    </main>
  )
}
