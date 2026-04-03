import type { CSSProperties } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { PageBackButton } from '../../../components/common/PageBackButton'
import { useAuth } from '../../auth/AuthProvider'

const linkStyle = ({ isActive }: { isActive: boolean }): CSSProperties => ({
  fontSize: 13,
  fontWeight: 600,
  padding: '8px 12px',
  borderRadius: 999,
  textDecoration: 'none',
  color: isActive ? 'var(--text-on-primary)' : 'var(--text-main)',
  background: isActive ? 'var(--primary)' : 'var(--bg-soft)',
  border: `1px solid ${isActive ? 'transparent' : 'var(--border)'}`,
})

export function NewsletterPortalLayout() {
  const { user } = useAuth()
  const gaCode = user?.gaCode?.trim()

  if (!gaCode) {
    return (
      <main className="page page--with-back insurer-news-page">
        <PageBackButton />
        <div className="insurer-news-empty">GA에 소속된 계정으로 로그인한 후 이용할 수 있습니다.</div>
      </main>
    )
  }

  return (
    <main className="page page--with-back insurer-news-page">
      <PageBackButton />
      <header className="page-header" style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 8 }}>원수사 소식지</h1>
        <p className="insurer-news-muted">
          현재 GA에 속한 보험사들의 최신 안내, 상품 정보, 공지 확인
        </p>
      </header>
      <nav
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 20,
        }}
        aria-label="원수사 소식지 하위 메뉴"
      >
        <NavLink to="/portal/newsletters" end style={linkStyle}>
          허브
        </NavLink>
        <NavLink to="/portal/newsletters/recent" style={linkStyle}>
          최근 소식 전체
        </NavLink>
        <NavLink to="/portal/newsletters/insurers" style={linkStyle}>
          보험사 목록
        </NavLink>
      </nav>
      <Outlet />
    </main>
  )
}
