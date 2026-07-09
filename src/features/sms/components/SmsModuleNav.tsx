import { Link, useLocation } from 'react-router-dom'
import type { SmsModuleTab } from '../types/sms.types'

export type SmsModuleNavActiveId = SmsModuleTab | 'automations'

type NavItem = {
  id: SmsModuleNavActiveId
  label: string
  path: string
}

const SMS_MODULE_NAV_ITEMS: NavItem[] = [
  { id: 'settings', label: '문자설정', path: '/sms/settings' },
  { id: 'send', label: '즉시발송', path: '/sms/send' },
  { id: 'reservations', label: '예약발송', path: '/sms/reservations' },
  { id: 'automations', label: '자동발송', path: '/sms/automations' },
  { id: 'groups', label: '그룹설정', path: '/sms/groups' },
  { id: 'templates', label: '템플릿관리', path: '/sms/templates' },
  { id: 'history', label: '발송내역', path: '/sms/history' },
]

function isNavItemActive(locationPath: string, locationSearch: string, item: NavItem): boolean {
  if (item.id === 'automations') {
    return locationPath.startsWith('/sms/automations')
  }
  if (item.id === 'send') {
    return locationPath === '/sms/send' && !locationSearch.includes('mode=reserved')
  }
  if (item.id === 'reservations') {
    return locationPath === '/sms/reservations' || (locationPath === '/sms/send' && locationSearch.includes('mode=reserved'))
  }
  return locationPath === item.path
}

export type SmsModuleNavProps = {
  variant: 'pc' | 'mobile'
  activeTab?: SmsModuleNavActiveId
}

export function SmsModuleNav({ variant, activeTab }: SmsModuleNavProps) {
  const location = useLocation()

  return (
    <nav className={`sms-module__tabs sms-module__tabs--${variant}`} aria-label="문자 모듈 메뉴">
      {SMS_MODULE_NAV_ITEMS.map((item) => {
        const active = activeTab ? activeTab === item.id : isNavItemActive(location.pathname, location.search, item)
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`sms-module__tab${active ? ' sms-module__tab--active' : ''}`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
