import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { FormButton, FormSelect } from '../../components/form'
import { useConfirmDialog } from '../../components/dialog'
import { listAdminUsers, listGaCompanies, type AdminUserRow, type GaCompanyRow } from '../auth/authApi'
import { formatKrMobileDisplay } from '../sms/smsDisplayUtils'
import {
  approveGaApproval,
  listGaApprovals,
  rejectGaApproval,
  type GaApprovalRequestRow,
  type GaApprovalStatus,
} from './gaApprovalApi'
import './gaMemberApproval.css'

type TabKey = 'members' | GaApprovalStatus

const TABS: { key: TabKey; label: string }[] = [
  { key: 'members', label: '전체 소속' },
  { key: 'PENDING', label: '승인 대기' },
  { key: 'APPROVED', label: '승인 완료 이력' },
  { key: 'REJECTED', label: '거절 이력' },
]

function fmt(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' })
}

/**
 * t291 — GA 소속 회원 / 가입 승인 관리.
 * GA_ADMIN: 서버가 본인 GA 로 강제 스코프. SUPER_ADMIN: 전체 + GA 필터.
 */
export default function GaMemberApprovalPage() {
  const { token, user } = useAuth()
  const isSuper = user?.role === 'SUPER_ADMIN'
  const [tab, setTab] = useState<TabKey>('PENDING')
  const [gaFilter, setGaFilter] = useState<number | null>(null)
  const [gas, setGas] = useState<GaCompanyRow[]>([])
  const [members, setMembers] = useState<AdminUserRow[]>([])
  const [requests, setRequests] = useState<GaApprovalRequestRow[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const { confirm, confirmDialog } = useConfirmDialog()

  useEffect(() => {
    if (!token || !isSuper) return
    listGaCompanies(token)
      .then((rows) => setGas(Array.isArray(rows) ? rows : []))
      .catch(() => setGas([]))
  }, [token, isSuper])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      if (tab === 'members') {
        const rows = await listAdminUsers(token, isSuper && gaFilter != null ? { gaId: gaFilter } : {})
        setMembers(rows)
        const r = await listGaApprovals(token, 'PENDING', isSuper ? gaFilter : null)
        setPendingCount(r.pendingCount)
      } else {
        const r = await listGaApprovals(token, tab, isSuper ? gaFilter : null)
        setRequests(r.items)
        setPendingCount(r.pendingCount)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token, tab, gaFilter, isSuper])

  useEffect(() => {
    void load()
  }, [load])

  async function onApprove(row: GaApprovalRequestRow) {
    if (!token) return
    const ok = await confirm({
      title: '가입 승인',
      message: `${row.applicantName || row.applicantUsername}님의 ${row.gaName} 소속 가입을 승인할까요?`,
      confirmLabel: '승인',
    })
    if (!ok) return
    setBusyId(row.id)
    setNotice('')
    try {
      await approveGaApproval(token, row.id)
      setNotice('승인했습니다.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '승인에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  async function onReject(row: GaApprovalRequestRow) {
    if (!token) return
    const reason = window.prompt('거절 사유(선택)', '')
    if (reason === null) return
    setBusyId(row.id)
    setNotice('')
    try {
      await rejectGaApproval(token, row.id, reason)
      setNotice('거절했습니다.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '거절에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page ga-approval">
      <header className="page-header ga-approval__header">
        <h1>{isSuper ? 'GA 가입 승인 관리' : '소속 회원 관리'}</h1>
        {isSuper ? (
          <FormSelect
            className="ga-approval__ga-select"
            value={gaFilter != null ? String(gaFilter) : ''}
            onChange={(e) => setGaFilter(e.target.value ? Number(e.target.value) : null)}
            aria-label="GA 필터"
            options={[{ value: '', label: '전체 GA' }, ...gas.map((g) => ({ value: String(g.id), label: g.name }))]}
          />
        ) : null}
      </header>

      <nav className="ga-approval__tabs" role="tablist">
        {TABS.map((t) => (
          <FormButton
            key={t.key}
            htmlType="button"
            variant="action"
            role="tab"
            aria-selected={tab === t.key}
            className={`ga-approval__tab${tab === t.key ? ' is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'PENDING' && pendingCount > 0 ? <span className="ga-approval__badge">{pendingCount}</span> : null}
          </FormButton>
        ))}
      </nav>

      {error ? <p className="status status--error">{error}</p> : null}
      {notice ? <p className="status status--success">{notice}</p> : null}
      {loading ? <p className="ga-approval__muted">불러오는 중…</p> : null}

      {!loading && tab === 'members' ? (
        members.length === 0 ? (
          <p className="ga-approval__muted">소속 회원이 없습니다.</p>
        ) : (
          <ul className="ga-approval__list">
            {members.map((m) => (
              <li key={m.id} className="ga-approval__row">
                <div className="ga-approval__main">
                  <strong>{m.display_name || m.username}</strong>
                  <span className="ga-approval__sub">
                    {m.username} · {m.role}
                    {isSuper ? ` · ${m.ga_company_name}` : ''}
                  </span>
                </div>
                <div className="ga-approval__meta">
                  <span>{m.phone_number ? formatKrMobileDisplay(m.phone_number) : '—'}</span>
                  <span>가입 {fmt(m.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {!loading && tab !== 'members' ? (
        requests.length === 0 ? (
          <p className="ga-approval__muted">
            {tab === 'PENDING' ? '승인 대기 중인 신청이 없습니다.' : '이력이 없습니다.'}
          </p>
        ) : (
          <ul className="ga-approval__list">
            {requests.map((r) => (
              <li key={r.id} className="ga-approval__row">
                <div className="ga-approval__main">
                  <strong>{r.applicantName || r.applicantUsername}</strong>
                  <span className="ga-approval__sub">
                    {r.applicantUsername}
                    {isSuper ? ` · ${r.gaName}` : ''}
                    {r.referrerName ? ` · 추천인 ${r.referrerName}` : ''}
                  </span>
                </div>
                <div className="ga-approval__meta">
                  <span>{r.applicantPhone ? formatKrMobileDisplay(r.applicantPhone) : '—'}</span>
                  <span>신청 {fmt(r.requestedAt)}</span>
                  {r.status !== 'PENDING' ? (
                    <span>
                      처리 {fmt(r.processedAt)}
                      {r.processedByName ? ` · ${r.processedByName}` : ''}
                    </span>
                  ) : null}
                  {r.status === 'REJECTED' && r.rejectReason ? <span>사유: {r.rejectReason}</span> : null}
                </div>
                {r.status === 'PENDING' ? (
                  <div className="ga-approval__actions">
                    <FormButton
                      htmlType="button"
                      variant="primary"
                      className="ga-approval__btn"
                      disabled={busyId === r.id}
                      onClick={() => void onApprove(r)}
                    >
                      승인
                    </FormButton>
                    <FormButton
                      htmlType="button"
                      variant="action"
                      className="button--outline ga-approval__btn"
                      disabled={busyId === r.id}
                      onClick={() => void onReject(r)}
                    >
                      거절
                    </FormButton>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
      {confirmDialog}
    </div>
  )
}
