import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import { listGaCompanies, type GaCompanyRow } from '../../auth/authApi'
import { GaCustomerExcelManagementPanel } from '../components/GaCustomerExcelManagementPanel'
import { createSuperAdminGaExcelManagementApi } from '../components/gaCustomerExcelManagementApi'

type TabKey = 'excel' | 'customerDb'

export default function GaCompanyManagePage() {
  const { gaId: gaIdParam } = useParams()
  const gaId = Number(gaIdParam)
  const location = useLocation()
  const { token, user } = useAuth()
  const [tab, setTab] = useState<TabKey>('excel')
  const [gaMeta, setGaMeta] = useState<{ name: string; code: string } | null>(null)
  const stateMeta = location.state as { name?: string; code?: string } | undefined

  const excelApi = useMemo(() => {
    if (!token?.trim() || !Number.isFinite(gaId) || gaId < 1) {
      return null
    }
    return createSuperAdminGaExcelManagementApi(token, gaId)
  }, [token, gaId])

  const loadGaMeta = useCallback(async () => {
    if (!token?.trim() || !Number.isFinite(gaId) || gaId < 1) {
      return
    }
    if (stateMeta?.name && stateMeta?.code) {
      setGaMeta({ name: stateMeta.name, code: stateMeta.code })
      return
    }
    try {
      const list = await listGaCompanies(token)
      const row = list.find((r: GaCompanyRow) => Number(r.id) === gaId)
      if (row) {
        setGaMeta({ name: row.name, code: row.code })
      }
    } catch {
      /* ignore */
    }
  }, [token, gaId, stateMeta?.name, stateMeta?.code])

  useEffect(() => {
    void loadGaMeta()
  }, [loadGaMeta])

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <main className="page page--with-back">
        <header className="page-header">
          <h1>GA 관리</h1>
          <p>전체 관리자만 접근할 수 있습니다.</p>
        </header>
      </main>
    )
  }

  if (!Number.isFinite(gaId) || gaId < 1) {
    return (
      <main className="page page--with-back">
        <p>잘못된 GA입니다.</p>
        <Link to="/admin/ga">목록으로</Link>
      </main>
    )
  }

  return (
    <main className="page page--with-back admin-ga-management">
      <header className="page-header">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline' }}>
          <Link to="/admin/ga" className="text-sm text-[var(--text-secondary)]">
            ← GA 목록
          </Link>
        </div>
        <h1 style={{ marginTop: 8 }}>GA 상세 관리</h1>
        <p>
          {gaMeta ? (
            <>
              <strong>{gaMeta.name}</strong> ({gaMeta.code}) · ID {gaId}
            </>
          ) : (
            <>GA #{gaId}</>
          )}
        </p>
      </header>

      <div className="card auth-card" style={{ maxWidth: 'none', margin: 0, padding: 12 }}>
        <div
          role="tablist"
          aria-label="GA-detail-tabs"
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 16,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <FormButton
            htmlType="button"
            variant={tab === 'customerDb' ? 'primary' : 'secondary'}
            className={tab === 'customerDb' ? 'button button--primary' : 'button button--secondary'}
            onClick={(ev) => {
              ev.stopPropagation()
              setTab('customerDb')
            }}
          >
            고객 DB 관리
          </FormButton>
          <FormButton
            htmlType="button"
            variant={tab === 'excel' ? 'primary' : 'secondary'}
            className={tab === 'excel' ? 'button button--primary' : 'button button--secondary'}
            onClick={(ev) => {
              ev.stopPropagation()
              setTab('excel')
            }}
          >
            고객 엑셀 관리
          </FormButton>
        </div>

        {tab === 'customerDb' ? (
          <p className="text-sm text-[var(--text-secondary)]" style={{ lineHeight: 1.6 }}>
            고객 등록·검색·수정은 설계사 화면의 <strong>고객관리</strong> 메뉴에서 수행합니다. 이 탭은 GA별 안내용으로 두었으며,
            추후 GA 전용 고객 DB 기능이 생기면 이 영역에 연결할 수 있습니다.
          </p>
        ) : null}

        {tab === 'excel' && excelApi ? <GaCustomerExcelManagementPanel api={excelApi} /> : null}
      </div>
    </main>
  )
}
