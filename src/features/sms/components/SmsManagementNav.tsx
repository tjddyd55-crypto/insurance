import { Link, useLocation } from 'react-router-dom'

const SMS_MANAGEMENT_LINKS = [
  { label: '즉시발송', path: '/sms/send' },
  { label: '예약발송', path: '/sms/reservations' },
  { label: '자동발송', path: '/sms/automations' },
  { label: '그룹설정', path: '/sms/groups' },
] as const

export function SmsManagementNav() {
  const location = useLocation()

  return (
    <nav className="sms-management-nav" aria-label="문자관리">
      {SMS_MANAGEMENT_LINKS.map((item) => {
        const active =
          item.path === '/sms/automations'
            ? location.pathname.startsWith('/sms/automations')
            : location.pathname + location.search === item.path ||
              (item.path === '/sms/groups' && location.pathname === '/sms/groups')
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`sms-management-nav__link${active ? ' sms-management-nav__link--active' : ''}`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
