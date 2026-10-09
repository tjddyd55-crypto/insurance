import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { listGaCompanies, type GaCompanyRow } from '../../auth/authApi'
import { useCallback, useEffect, useState } from 'react'
import { LoadingState, StatusMessage } from '../../../components/feedback'
import GaAdminDelegatesPanel from '../panels/GaAdminDelegatesPanel'
import GaAdminBoardWritersPanel from '../panels/GaAdminBoardWritersPanel'
import UserInsurerAccountsPage from '../../user-insurer-accounts/pages/UserInsurerAccountsPage'
import { NewsletterBoardAdminPage } from '../../insurer-news/pages/NewsletterBoardAdminPage'
import GaAdminFeaturesSettingsPanel from '../panels/GaAdminFeaturesSettingsPanel'
import '../ga-admin-workspace.css'

const TAB_LINKS = [
  { to: 'basic', label: '기본 설정' },
  { to: 'features', label: '기능 설정' },
  { to: 'accounts/delegates', label: '관리자 · STEP' },
  { to: 'accounts/insurer', label: '원수사 계정' },
  { to: 'accounts/writers', label: '소식지 작성자' },
  { to: 'newsletter', label: '소식지 설정' },
] as const

function formatGaStatus(status: string): string {
  const v = String(status ?? '').toLowerCase()
  if (v === 'active') return '사용 중'
  if (v === 'inactive') return '비활성'
  if (v === 'blocked') return '접근 금지'
  return status || '—'
}

function GaAdminBasicTab() {
  const { token, user } = useAuth()
  const [row, setRow] = useState<GaCompanyRow | null>(null)
  const [err, setErr] = useState('')
  const load = useCallback(async () => {
    if (!token?.trim()) return
    setErr('')
    try {
      const list = await listGaCompanies(token)
      const mine = list.find((r) => Number(r.id) === Number(user?.gaId)) ?? list[0] ?? null
      setRow(mine)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'GA 정보를 불러오지 못했습니다.')
    }
  }, [token, user?.gaId])
  useEffect(() => {
    void load()
  }, [load])
  if (err) {
    return (
      <div className="admin-data-card">
        <StatusMessage tone="error" message={err} />
      </div>
    )
  }
  if (!row) {
    return (
      <div className="admin-data-card">
        <LoadingState message="GA 정보 불러오는 중…" />
      </div>
    )
  }
  return (
    <div className="admin-data-card">
      <h2 className="admin-data-card__title">GA 기본 정보</h2>
      <dl className="ga-admin-workspace-meta">
        <div>
          <dt>GA 이름</dt>
          <dd>{row.name}</dd>
        </div>
        <div>
          <dt>GA 코드</dt>
          <dd>{row.code}</dd>
        </div>
        <div>
          <dt>상태</dt>
          <dd>{formatGaStatus(row.status)}</dd>
        </div>
      </dl>
      <p className="text-sm text-[var(--text-secondary)]">
        플랫폼 전역 GA 코드·테넌트 변경은 SUPER_ADMIN 전용입니다. 연락처·대표 정보는{' '}
        <Link to="/profile">계정 설정</Link>에서 관리할 수 있습니다.
      </p>
    </div>
  )
}

export default function GaAdminWorkspacePage() {
  const location = useLocation()
  const base = '/ga-admin/workspace'

  return (
    <main className="page page--with-back admin-page-shell ga-admin-workspace-page">
      <div className="admin-page-shell__inner">
        <header className="page-header admin-page-shell__header">
          <h1>GA 관리</h1>
          <p>
            GA 기본정보, STEP, 원수사 계정, 소식지 설정을 관리합니다. 보험청구·PDF 템플릿은 상단 「업무 운영」
            메뉴에서 열 수 있습니다.
          </p>
        </header>
        <nav className="ga-admin-workspace-tabs" aria-label="GA 관리 영역">
          {TAB_LINKS.map((tab) => (
            <NavLink
              key={tab.to}
              to={`${base}/${tab.to}`}
              className={({ isActive }) =>
                `ga-admin-workspace-tabs__link${isActive ? ' ga-admin-workspace-tabs__link--active' : ''}`
              }
              end={tab.to === 'basic'}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <div className="ga-admin-workspace-body">
          <Routes>
            <Route index element={<Navigate to="basic" replace />} />
            <Route path="basic" element={<GaAdminBasicTab />} />
            <Route path="features" element={<GaAdminFeaturesSettingsPanel />} />
            <Route path="accounts/delegates" element={<GaAdminDelegatesPanel />} />
            <Route path="accounts/insurer" element={<UserInsurerAccountsPage embedded />} />
            <Route path="accounts/writers" element={<GaAdminBoardWritersPanel />} />
            <Route path="newsletter" element={<NewsletterBoardAdminPage embedded />} />
            <Route path="*" element={<Navigate to="basic" replace state={{ from: location }} />} />
          </Routes>
        </div>
      </div>
    </main>
  )
}
