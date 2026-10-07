import { useEffect, useRef } from 'react'

export type CustomerWorkspaceTabItem = {
  id: string
  label: string
  disabled?: boolean
  title?: string
  hidden?: boolean
  onSelect: () => void
}

type Props = {
  tabs: CustomerWorkspaceTabItem[]
  activeTabId: string | null
  ariaLabel?: string
}

export function CustomerWorkspaceTabs({
  tabs,
  activeTabId,
  ariaLabel = '고객 작업 메뉴',
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
  }, [activeTabId])

  const visibleTabs = tabs.filter((tab) => !tab.hidden)

  return (
    <div className="customer-workspace-page__tabs">
      <div
        ref={scrollRef}
        className="customer-workspace-page__tab-scroll"
        role="tablist"
        aria-label={ariaLabel}
      >
        {visibleTabs.map((tab) => {
          const isActive = activeTabId === tab.id
          return (
            <button
              key={tab.id}
              ref={isActive ? activeTabRef : undefined}
              type="button"
              role="tab"
              id={`customer-workspace-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls="customer-workspace-page-panel"
              tabIndex={isActive ? 0 : -1}
              className={
                isActive
                  ? 'customer-workspace-page__tab customer-workspace-page__tab--active'
                  : 'customer-workspace-page__tab'
              }
              disabled={tab.disabled}
              title={tab.title}
              data-workspace-tab={tab.id}
              onClick={tab.onSelect}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
