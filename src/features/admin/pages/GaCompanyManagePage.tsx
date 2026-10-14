import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import { listGaCompanies, patchGaCompany, type GaCompanyRow } from '../../auth/authApi'
import { GaCustomerExcelManagementPanel } from '../components/GaCustomerExcelManagementPanel'
import { GaGaAdminAccountsPanel } from '../components/GaGaAdminAccountsPanel'
import { createSuperAdminGaExcelManagementApi } from '../components/gaCustomerExcelManagementApi'

type TabKey = 'gaAdmins' | 'dataMapping'

export default function GaCompanyManagePage() {
  const { gaId: gaIdParam } = useParams()
  const gaId = Number(gaIdParam)
  const location = useLocation()
  const { token, user } = useAuth()
  const [tab, setTab] = useState<TabKey>('gaAdmins')
  const [gaMeta, setGaMeta] = useState<{ name: string; code: string } | null>(null)
  const stateMeta = location.state as { name?: string; code?: string } | undefined
  const [acceptsSignup, setAcceptsSignup] = useState<boolean | null>(null)
  const [isGeneralGa, setIsGeneralGa] = useState(false)
  const [signupSaving, setSignupSaving] = useState(false)
  const [signupMsg, setSignupMsg] = useState('')

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
    try {
      const list = await listGaCompanies(token)
      const row = list.find((r: GaCompanyRow) => Number(r.id) === gaId)
      if (row) {
        setGaMeta({ name: row.name, code: row.code })
        setAcceptsSignup(row.accepts_partner_signup === true)
        setIsGeneralGa(String(row.code ?? '').toUpperCase() === 'GENERAL')
      } else if (stateMeta?.name && stateMeta?.code) {
        setGaMeta({ name: stateMeta.name, code: stateMeta.code })
      }
    } catch {
      /* ignore */
    }
  }, [token, gaId, stateMeta?.name, stateMeta?.code])

  useEffect(() => {
    void loadGaMeta()
  }, [loadGaMeta])

  const toggleAcceptsSignup = async () => {
    if (!token || acceptsSignup == null) return
    setSignupSaving(true)
    setSignupMsg('')
    try {
      const updated = await patchGaCompany(token, gaId, { accepts_partner_signup: !acceptsSignup })
      setAcceptsSignup(updated.accepts_partner_signup === true)
      setSignupMsg(updated.accepts_partner_signup ? '가입 신청을 허용했습니다.' : '가입 신청을 막았습니다.')
    } catch (e) {
      setSignupMsg(e instanceof Error ? e.message : '변경에 실패했습니다.')
    } finally {
      setSignupSaving(false)
    }
  }

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

      {!isGeneralGa && acceptsSignup != null ? (
        <section
          className="card auth-card"
          style={{ maxWidth: 'none', margin: '0 0 12px', padding: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
          aria-label="가입 신청 허용"
        >
          <div style={{ flex: '1 1 240px' }}>
            <strong>가입 신청 허용</strong>{' '}
            <span className={acceptsSignup ? 'status' : 'text-[var(--text-sub)]'}>{acceptsSignup ? 'ON' : 'OFF'}</span>
            <p className="text-xs text-[var(--text-sub)]" style={{ margin: '4px 0 0' }}>
              ON이면 회원가입의 제휴 GA 검색에 노출되고 승인 가입 신청을 받습니다. GA 활성 상태·공식 가입 링크와는 별개입니다.
            </p>
            {signupMsg ? <p className="text-xs" style={{ margin: '4px 0 0' }}>{signupMsg}</p> : null}
          </div>
          <FormButton
            htmlType="button"
            variant={acceptsSignup ? 'secondary' : 'primary'}
            className={acceptsSignup ? 'button button--secondary' : 'button button--primary'}
            disabled={signupSaving}
            onClick={() => void toggleAcceptsSignup()}
            role="switch"
            aria-checked={acceptsSignup}
          >
            {acceptsSignup ? '허용 끄기' : '허용 켜기'}
          </FormButton>
        </section>
      ) : null}

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
            variant={tab === 'gaAdmins' ? 'primary' : 'secondary'}
            className={tab === 'gaAdmins' ? 'button button--primary' : 'button button--secondary'}
            onClick={(ev) => {
              ev.stopPropagation()
              setTab('gaAdmins')
            }}
          >
            GA 관리자 계정
          </FormButton>
          <FormButton
            htmlType="button"
            variant={tab === 'dataMapping' ? 'primary' : 'secondary'}
            className={tab === 'dataMapping' ? 'button button--primary' : 'button button--secondary'}
            onClick={(ev) => {
              ev.stopPropagation()
              setTab('dataMapping')
            }}
          >
            GA 데이터 매핑
          </FormButton>
        </div>

        {tab === 'gaAdmins' ? <GaGaAdminAccountsPanel gaId={gaId} /> : null}

        {tab === 'dataMapping' && excelApi ? <GaCustomerExcelManagementPanel api={excelApi} /> : null}
      </div>
    </main>
  )
}
