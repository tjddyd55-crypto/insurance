import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FormButton } from '../form'
import { useAuth } from '../../features/auth/AuthProvider'
import { buildAppMenuForSession } from '../../features/dashboard/gaTenantMenu'
import { fetchTeamMembers } from '../../features/team/api/teamApi'
import { isActivePcNavigationPath } from './pcNavigationUtils'
import './pc-top-navigation.css'

export default function PCTopNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, token } = useAuth()
  const [teamMenuManageVisible, setTeamMenuManageVisible] = useState(false)

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

  const items = useMemo(() => {
    return buildAppMenuForSession(user?.role, user?.gaCode, user?.gaName, {
      teamMenuManageVisible,
      subscriptionExpired: user?.subscription?.effectiveStatus === 'EXPIRED',
    })
  }, [
    teamMenuManageVisible,
    user?.role,
    user?.gaCode,
    user?.gaName,
    user?.subscription?.effectiveStatus,
  ])

  const safeItems = items.filter(Boolean)

  return (
    <nav className="pc-top-navigation" aria-label="PC 상단 주요 메뉴">
      {safeItems.map((item, index) => {
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
          isActivePcNavigationPath(location.pathname, item.path)

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
              navigate(item.path)
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
