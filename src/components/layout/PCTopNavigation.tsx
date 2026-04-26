import { FormButton } from '../form'
import type { GaTenantDashboardMenuEntry } from '../../features/dashboard/gaTenantMenu'
import './pc-top-navigation.css'

type Props = {
  items: GaTenantDashboardMenuEntry[]
  pathname: string
  isActivePath: (pathname: string, itemPath: string) => boolean
  onNavigate: (path: string) => void
}

export default function PCTopNavigation({
  items,
  pathname,
  isActivePath,
  onNavigate,
}: Props) {
  return (
    <nav className="pc-top-navigation" aria-label="PC 상단 주요 메뉴">
      {items.map((item, index) => {
        if (item.type === 'divider') {
          return <div key={`pc-top-divider-${index}`} className="pc-top-navigation__divider" role="presentation" />
        }
        if (item.type === 'section') {
          return (
            <div key={`pc-top-section-${index}`} className="pc-top-navigation__section" role="presentation">
              {item.label}
            </div>
          )
        }

        const isDisabled = Boolean(item.disabled || item.preparing)
        const isActive =
          !isDisabled &&
          item.path.trim() !== '' &&
          item.path !== '#' &&
          isActivePath(pathname, item.path)

        return (
          <FormButton
            key={`${item.path}-${item.label}-${index}`}
            htmlType="button"
            variant="secondary"
            className={`pc-top-navigation__item${isActive ? ' pc-top-navigation__item--active' : ''}`}
            disabled={isDisabled}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => {
              if (isDisabled) {
                return
              }
              if (!item.path.trim() || item.path === '#') {
                return
              }
              onNavigate(item.path)
            }}
          >
            <span className="pc-top-navigation__item-label">{item.label}</span>
            {item.badge ? <span className="pc-top-navigation__item-badge">{item.badge}</span> : null}
          </FormButton>
        )
      })}
    </nav>
  )
}
