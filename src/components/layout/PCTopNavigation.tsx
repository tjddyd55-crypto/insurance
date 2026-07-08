import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FormButton } from '../form'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  buildAppMenuForSession,
  type DynamicNewsletterBoardMenuItem,
  type GaTenantDashboardMenuEntry,
} from '../../features/dashboard/gaTenantMenu'
import { fetchTeamMembers } from '../../features/team/api/teamApi'
import { listVisibleNewsletterBoards } from '../../features/insurer-news/services/insurerNews.service'
import { mapNewsletterBoardsToMenuItems } from '../../features/insurer-news/utils/newsletterBoardMenuLinks'
import { NotificationBell } from '../../features/notification/components/NotificationBell'
import BillingStatusBadge from '../../features/insurance-billing/components/BillingStatusBadge'
import { isActivePcNavigationPath } from './pcNavigationUtils'
import './pc-top-navigation.css'

type LinkEntry = Extract<GaTenantDashboardMenuEntry, { type: 'link' }>

type MenuGroup = {
  label: string
  items: LinkEntry[]
}

type Props = {
  showNotification?: boolean
  onLogout?: () => void
}

function buildMenuGroups(entries: GaTenantDashboardMenuEntry[]): MenuGroup[] {
  const groups: MenuGroup[] = []
  let currentGroup: MenuGroup | null = null

  for (const entry of entries.filter(Boolean)) {
    if (entry.type === 'divider') {
      continue
    }
    if (entry.type === 'section') {
      currentGroup = { label: entry.label, items: [] }
      groups.push(currentGroup)
      continue
    }
    if (!currentGroup) {
      currentGroup = { label: '메뉴', items: [] }
      groups.push(currentGroup)
    }
    currentGroup.items.push(entry)
  }

  return groups.filter((group) => group.items.length > 0)
}

export default function PCTopNavigation({
  showNotification = false,
  notificationBoundaryRef,
  onLogout,
}: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, token } = useAuth()
  const menuRef = useRef<HTMLElement | null>(null)
  const [teamMenuManageVisible, setTeamMenuManageVisible] = useState(false)
  const [dynamicNewsletterBoards, setDynamicNewsletterBoards] = useState<DynamicNewsletterBoardMenuItem[]>([])
  const [hoveredGroupLabel, setHoveredGroupLabel] = useState<string | null>(null)
  const [pinnedGroupLabel, setPinnedGroupLabel] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) {
        return
      }
      if (!token?.trim() || !user?.id) {
        setTeamMenuManageVisible(false)
        return
      }
      if (user?.role !== 'USER' && user?.role !== 'GA_ADMIN') {
        setTeamMenuManageVisible(false)
        return
      }
      if (!user?.teamId?.trim()) {
        setTeamMenuManageVisible(false)
        return
      }
      void fetchTeamMembers(token)
        .then((data) => {
          if (cancelled) {
            return
          }
          const ownerId = data.ownerId?.trim() ?? ''
          setTeamMenuManageVisible(Boolean(ownerId && ownerId === user?.id))
        })
        .catch(() => {
          if (!cancelled) {
            setTeamMenuManageVisible(false)
          }
        })
    })
    return () => {
      cancelled = true
    }
  }, [token, user?.id, user?.role, user?.teamId])

  useEffect(() => {
    let cancelled = false
    if (!token?.trim() || (user?.role !== 'USER' && user?.role !== 'GA_ADMIN' && user?.role !== 'GA_STAFF')) {
      setDynamicNewsletterBoards([])
      return () => {
        cancelled = true
      }
    }
    void listVisibleNewsletterBoards(token)
      .then((boards) => {
        if (cancelled) {
          return
        }
        setDynamicNewsletterBoards(mapNewsletterBoardsToMenuItems(boards))
      })
      .catch(() => {
        if (!cancelled) {
          setDynamicNewsletterBoards([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, user?.role])

  useEffect(() => {
    function handleDocumentMouseDown(event: MouseEvent) {
      const target = event.target as Node | null
      if (!target || menuRef.current?.contains(target)) {
        return
      }
      setPinnedGroupLabel(null)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPinnedGroupLabel(null)
        setHoveredGroupLabel(null)
      }
    }

    document.addEventListener('mousedown', handleDocumentMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const items = useMemo(() => {
    return buildAppMenuForSession(user?.role, user?.gaCode, user?.gaName, {
      teamMenuManageVisible,
      dynamicNewsletterBoards,
      subscriptionExpired: user?.subscription?.effectiveStatus === 'EXPIRED',
    })
  }, [
    teamMenuManageVisible,
    dynamicNewsletterBoards,
    user?.role,
    user?.gaCode,
    user?.gaName,
    user?.subscription?.effectiveStatus,
  ])

  const groups = useMemo(() => buildMenuGroups(items), [items])
  const activeGroup = useMemo(() => {
    return groups.find((group) =>
      group.items.some((item) =>
        !item.disabled &&
        !item.preparing &&
        item.path.trim() !== '' &&
        item.path !== '#' &&
        isActivePcNavigationPath(location.pathname, item.path, location.search),
      ),
    )
  }, [groups, location.pathname, location.search])

  const openGroupLabel = hoveredGroupLabel ?? pinnedGroupLabel
  const openGroup = openGroupLabel
    ? groups.find((group) => group.label === openGroupLabel) ?? null
    : null

  const closeSubMenus = () => {
    setPinnedGroupLabel(null)
    setHoveredGroupLabel(null)
  }

  return (
    <nav
      ref={menuRef}
      className="pc-top-navigation pc-top-navigation--dropdown"
      aria-label="PC 상단 주요 메뉴"
      onMouseLeave={() => setHoveredGroupLabel(null)}
    >
      <div className="pc-top-navigation__bar">
        <div className="pc-top-navigation__groups" role="menubar" aria-label="PC 업무 대분류 메뉴">
          {groups.map((group) => {
            const isActive = activeGroup?.label === group.label
            const isOpen = openGroupLabel === group.label
            const isPinned = pinnedGroupLabel === group.label
            return (
              <button
                key={group.label}
                type="button"
                className={`pc-top-navigation__group${isActive ? ' pc-top-navigation__group--active' : ''}${isOpen ? ' pc-top-navigation__group--open' : ''}${isPinned ? ' pc-top-navigation__group--pinned' : ''}`}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                onMouseEnter={() => setHoveredGroupLabel(group.label)}
                onFocus={() => setHoveredGroupLabel(group.label)}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setPinnedGroupLabel((current) => (current === group.label ? null : group.label))
                  setHoveredGroupLabel(group.label)
                }}
              >
                {group.label}
              </button>
            )
          })}
        </div>

        <div className="pc-top-navigation__actions" aria-label="PC 상단 액션">
          <BillingStatusBadge />
          {showNotification ? (
            <NotificationBell variant="workspaceHeader" />
          ) : null}
          {onLogout ? (
            <FormButton
              htmlType="button"
              variant="secondary"
              className="pc-top-navigation__logout"
              onClick={onLogout}
            >
              로그아웃
            </FormButton>
          ) : null}
        </div>
      </div>

      {openGroup ? (
        <div className="pc-top-navigation__dropdown" role="menu" aria-label={`${openGroup.label} 하위 메뉴`}>
          <div className="pc-top-navigation__dropdown-items">
            {openGroup.items.map((item, index) => {
              const isDisabled = Boolean(item.disabled || item.preparing)
              const isActive =
                !isDisabled &&
                item.path.trim() !== '' &&
                item.path !== '#' &&
                isActivePcNavigationPath(location.pathname, item.path, location.search)

              return (
                <FormButton
                  key={`${item.path}-${item.label}-${index}`}
                  htmlType="button"
                  variant="secondary"
                  className={`pc-top-navigation__item${isActive ? ' pc-top-navigation__item--active' : ''}`}
                  disabled={isDisabled}
                  role="menuitem"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    if (isDisabled) {
                      return
                    }
                    if (!item.path.trim() || item.path === '#') {
                      return
                    }
                    navigate(item.path)
                    closeSubMenus()
                  }}
                >
                  <span className="pc-top-navigation__item-label">{item.label}</span>
                  {item.badge ? <span className="pc-top-navigation__item-badge">{item.badge}</span> : null}
                </FormButton>
              )
            })}
          </div>
        </div>
      ) : null}
    </nav>
  )
}
