import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { getCustomerAppMe } from '../api/customerAppApi'
import { readCustomerAppSession } from '../session/customerAppSession'
import '../customer-app.css'

/**
 * 고객앱 레이아웃 Shell.
 *
 * 책임 분리:
 *   - 상단: 담당 설계사 이름 + 전화번호(tel: 링크) — 모든 페이지 공통 노출
 *   - 본문: children (페이지가 자율적으로 채움)
 *   - 하단: 고정 탭바 3개(청구내역 / 개인메시지 / 내정보) — 메인 흐름 진입점
 *
 * 의도적으로 뺀 것:
 *   - 상단 링크 클러스터(청구요청/전체소식지/개인소식지 등) — 메인 CTA 경쟁을 막기 위함
 *   - 연결 초기화 버튼 — 내정보 페이지로 이관 (파괴적 액션은 한 단계 안으로)
 */

interface Props {
  title: string
  children: ReactNode
}

interface HeaderInfo {
  agentName: string
  agentPhone: string | null
}

const HEADER_FALLBACK: HeaderInfo = { agentName: '담당 설계사', agentPhone: null }

function formatKrPhone(raw: string | null): string {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (!digits) {
    return ''
  }
  if (digits.startsWith('02') && digits.length >= 9) {
    return `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return digits
}

export default function CustomerAppShell({ title, children }: Props) {
  const session = readCustomerAppSession()
  const [header, setHeader] = useState<HeaderInfo>(() =>
    session
      ? { agentName: session.agentName || HEADER_FALLBACK.agentName, agentPhone: null }
      : HEADER_FALLBACK,
  )

  useEffect(() => {
    if (!session) {
      return
    }
    let mounted = true
    void (async () => {
      try {
        const me = await getCustomerAppMe(session.appToken)
        if (!mounted) {
          return
        }
        setHeader({
          agentName: me.agentName || HEADER_FALLBACK.agentName,
          agentPhone: me.agentPhone ?? null,
        })
      } catch {
        // 실패해도 세션 캐시로 이미 이름이 표시되어 있으니 조용히 흡수.
      }
    })()
    return () => {
      mounted = false
    }
  }, [session])

  return (
    <div className="customer-app-shell">
      <header className="customer-app-header">
        <div className="customer-app-header__role">담당 설계사</div>
        <div className="customer-app-header__agent">
          <span className="customer-app-header__name">{header.agentName}</span>
          {header.agentPhone ? (
            <a
              className="customer-app-header__phone"
              href={`tel:${header.agentPhone.replace(/\D/g, '')}`}
              aria-label={`담당 설계사에게 전화걸기 ${header.agentPhone}`}
            >
              {formatKrPhone(header.agentPhone)}
            </a>
          ) : null}
        </div>
      </header>

      <main className="customer-app-main" aria-label={title}>
        {children}
      </main>

      <CustomerAppBottomNav />
    </div>
  )
}

interface TabItem {
  to: string
  label: string
  match: (pathname: string) => boolean
}

const TABS: TabItem[] = [
  {
    to: '/customer-app/requests',
    label: '청구내역',
    match: (path) => path.startsWith('/customer-app/requests'),
  },
  {
    to: '/customer-app/news/personal',
    label: '개인메시지',
    match: (path) => path.startsWith('/customer-app/news/personal'),
  },
  {
    to: '/customer-app/profile',
    label: '내정보',
    match: (path) => path.startsWith('/customer-app/profile'),
  },
]

function CustomerAppBottomNav() {
  const location = useLocation()
  return (
    <nav className="customer-app-tabbar" aria-label="고객앱 주요 메뉴">
      {TABS.map((tab) => {
        const active = tab.match(location.pathname)
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={`customer-app-tabbar__item${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {tab.label}
          </NavLink>
        )
      })}
    </nav>
  )
}
