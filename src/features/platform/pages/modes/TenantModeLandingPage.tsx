import { Link, useParams } from 'react-router-dom'

/** SUPER_ADMIN 전용 Tenant Mode 시작점 placeholder(`/admin/tenant/:tenantId`). */
export default function TenantModeLandingPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const id = tenantId?.trim() || '—'

  return (
    <main className="page platform-admin-page platform-admin-page--pc page--with-back">
      <div className="platform-admin-page__toolbar">
        <Link to="/admin/platform" className="platform-admin-page__back">
          ← 플랫폼 관리
        </Link>
      </div>

      <header className="platform-admin-page__head">
        <h1 className="platform-admin-page__title">Tenant Mode</h1>
        <p className="platform-admin-page__lede platform-mode-landing platform-mode-landing__id-row">
          <span className="platform-admin-page__muted">테넌트 ID</span>{' '}
          <span className="platform-admin-page__mono">{id}</span>
        </p>
      </header>

      <div className="platform-admin-page__panel platform-mode-landing">
        <p className="platform-mode-landing__p">이 화면은 테넌트 관리자 모드의 시작 페이지입니다.</p>
        <p className="platform-mode-landing__p">
          현재는 placeholder 단계이며, 실제 Staff/User 관리와 테넌트 관리는 기존 플랫폼 관리 화면에서
          진행합니다.
        </p>

        <h2 className="platform-mode-landing__subhead">향후 기능(예정)</h2>
        <ul className="platform-mode-landing__list">
          <li>Staff/User 관리</li>
          <li>테넌트 설정</li>
          <li>고객관리 템플릿 적용 확인</li>
          <li>Work Mode 연결</li>
          <li>고객관리 업무 화면 진입</li>
        </ul>

        <div className="platform-mode-landing__link-stack">
          <p className="platform-mode-landing__link-row">
            <Link to="/admin/platform" className="platform-admin-page__inline-link">
              플랫폼 관리 허브로 이동
            </Link>
          </p>
          <p className="platform-mode-landing__link-row">
            <Link to="/admin/platform/industries" className="platform-admin-page__inline-link">
              Industry 목록(플랫폼 관리)으로 이동
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
