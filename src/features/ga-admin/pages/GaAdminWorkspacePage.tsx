import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { listGaCompanies, type GaCompanyRow } from '../../auth/authApi'
import { useCallback, useEffect, useState } from 'react'
import { LoadingState, StatusMessage } from '../../../components/feedback'
import GaAdminDelegatesPanel from '../panels/GaAdminDelegatesPanel'
import GaAdminBoardWritersPanel from '../panels/GaAdminBoardWritersPanel'
import UserInsurerAccountsPage from '../../user-insurer-accounts/pages/UserInsurerAccountsPage'
import { useGaSettings } from '../../ga-settings/useGaSettings'

const TAB_LINKS = [
  { to: 'basic', label: '기본 설정' },
  { to: 'features', label: '기능 설정' },
  { to: 'accounts/delegates', label: '관리자·STEP' },
  { to: 'accounts/insurer', label: '원수사 계정' },
  { to: 'accounts/writers', label: '소식지 작성자' },
  { to: 'newsletter', label: '소식지 설정' },
] as const

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
    return <StatusMessage tone="error" message={err} />
  }
  if (!row) {
    return <LoadingState message="GA 정보 불러오는 중…" />
  }
  return (
    <div className="ga-admin-workspace-panel">
      <h2 className="ga-admin-workspace-panel__title">GA 기본정보</h2>
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
          <dd>{row.status}</dd>
        </div>
      </dl>
      <p className="text-sm text-[var(--text-secondary)]">
        플랫폼 전역 GA 코드·테넌트 변경은 SUPER_ADMIN 전용입니다. 연락처·대표 정보는{' '}
        <Link to="/profile">계정 설정</Link>에서 관리할 수 있습니다.
      </p>
    </div>
  )
}

function GaAdminFeaturesTab() {
  const { gaSettings, loading } = useGaSettings()
  if (loading) {
    return <LoadingState message="기능 설정 불러오는 중…" />
  }
  return (
    <div className="ga-admin-workspace-panel">
      <h2 className="ga-admin-workspace-panel__title">GA 기능 설정</h2>
      <ul className="ga-admin-workspace-feature-list">
        <li>
          GA Excel 고객 DB: <strong>{gaSettings.use_ga_excel ? 'ON' : 'OFF'}</strong>
        </li>
      </ul>
      <p className="text-sm text-[var(--text-secondary)]">
        세부 Excel 매핑·샘플 업로드는 SUPER_ADMIN GA 상세 화면에서 설정됩니다. 변경 요청은 기능 요청 또는
        플랫폼 관리자에게 문의해 주세요.
      </p>
    </div>
  )
}

function GaAdminNewsletterTab() {
  return (
    <div className="ga-admin-workspace-panel">
      <h2 className="ga-admin-workspace-panel__title">소식지 설정</h2>
      <p>GA 전용 게시판 생성·비활성화·작성자 연결은 소식지 관리 화면에서 진행합니다.</p>
      <Link className="button button--primary" to="/admin/newsletter-boards">
        GA전용 소식지 관리 열기
      </Link>
    </div>
  )
}

export default function GaAdminWorkspacePage() {
  const location = useLocation()
  const base = '/ga-admin/workspace'

  return (
    <main className="page page--with-back ga-admin-workspace-page">
      <header className="ga-admin-workspace-header">
        <h1>GA 관리</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          기본·계정·소식지 설정을 한곳에서 관리합니다. 보험청구·PDF 템플릿은 메뉴의 「업무 운영」에서
          열 수 있습니다.
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
          <Route path="features" element={<GaAdminFeaturesTab />} />
          <Route path="accounts/delegates" element={<GaAdminDelegatesPanel />} />
          <Route path="accounts/insurer" element={<UserInsurerAccountsPage />} />
          <Route path="accounts/writers" element={<GaAdminBoardWritersPanel />} />
          <Route path="newsletter" element={<GaAdminNewsletterTab />} />
          <Route path="*" element={<Navigate to="basic" replace state={{ from: location }} />} />
        </Routes>
      </div>
    </main>
  )
}
