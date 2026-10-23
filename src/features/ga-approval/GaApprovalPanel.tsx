import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { listGaCompanies, type GaCompanyRow } from '../auth/authApi'
import { FormButton, FormSelect } from '../../components/form'
import { useConfirmDialog } from '../../components/dialog'
import { formatKrMobileDisplay } from '../sms/smsDisplayUtils'
import {
  approveGaApproval,
  listGaApprovals,
  rejectGaApproval,
  type GaApprovalRequestRow,
  type GaApprovalStatus,
} from './gaApprovalApi'
import './gaMemberApproval.css'

function fmt(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' })
}

/**
 * t291b — 유저 관리 화면의 가입 신청 탭(승인 대기 / 승인 완료 이력 / 거절 이력).
 * GA_ADMIN: 서버가 본인 GA 로 강제. SUPER_ADMIN: 전체 + GA 필터.
 */
export function GaApprovalPanel({
  status,
  onPendingCount,
}: {
  status: GaApprovalStatus
  onPendingCount?: (n: number) => void
}) {
  const { token, user } = useAuth()
  const isSuper = user?.role === 'SUPER_ADMIN'
  const [gaFilter, setGaFilter] = useState<number | null>(null)
  const [gas, setGas] = useState<GaCompanyRow[]>([])
  const [rows, setRows] = useState<GaApprovalRequestRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const { confirm, prompt, confirmDialog } = useConfirmDialog()

  useEffect(() => {
    if (!token || !isSuper) return
    listGaCompanies(token)
      .then((r) => setGas(Array.isArray(r) ? r : []))
      .catch(() => setGas([]))
  }, [token, isSuper])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const r = await listGaApprovals(token, status, isSuper ? gaFilter : null)
      setRows(r.items)
      onPendingCount?.(r.pendingCount)
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token, status, gaFilter, isSuper, onPendingCount])

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
    const reason = await prompt({ title: '거절 사유(선택)', defaultValue: '' })
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
    <section className="card admin-user-management__table-wrap ga-approval" style={{ maxWidth: 'none', margin: 0, padding: 12 }}>
      {isSuper ? (
        <div className="ga-approval__header">
          <FormSelect
            className="ga-approval__ga-select"
            value={gaFilter != null ? String(gaFilter) : ''}
            onChange={(e) => setGaFilter(e.target.value ? Number(e.target.value) : null)}
            aria-label="GA 필터"
            options={[{ value: '', label: '전체 GA' }, ...gas.map((g) => ({ value: String(g.id), label: g.name }))]}
          />
        </div>
      ) : null}
      {error ? <p className="status status--error">{error}</p> : null}
      {notice ? <p className="status status--success">{notice}</p> : null}
      <div className="table-container">
        <table className="admin-user-table admin-data-table ga-approval__table">
          <thead>
            <tr>
              <th scope="col">신청 GA</th>
              <th scope="col">이름</th>
              <th scope="col">아이디</th>
              <th scope="col">연락처</th>
              <th scope="col">추천인</th>
              <th scope="col">신청일</th>
              <th scope="col">{status === 'PENDING' ? '상태' : '처리일 · 처리자'}</th>
              <th scope="col">{status === 'PENDING' ? '관리' : status === 'REJECTED' ? '거절 사유' : '결과'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="ga-approval__muted">불러오는 중…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="ga-approval__muted">
                  {status === 'PENDING' ? '승인 대기 중인 신청이 없습니다.' : '이력이 없습니다.'}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.gaName}</td>
                  <td>{r.applicantName || '—'}</td>
                  <td>{r.applicantUsername}</td>
                  <td>{r.applicantPhone ? formatKrMobileDisplay(r.applicantPhone) : '—'}</td>
                  <td>{r.referrerName || '—'}</td>
                  <td>{fmt(r.requestedAt)}</td>
                  <td>
                    {status === 'PENDING' ? '승인 대기' : `${fmt(r.processedAt)}${r.processedByName ? ` · ${r.processedByName}` : ''}`}
                  </td>
                  <td className="admin-table-cell--actions">
                    {status === 'PENDING' ? (
                      <div className="admin-table-actions">
                        <FormButton
                          htmlType="button"
                          variant="primary"
                          className="button button--primary"
                          disabled={busyId === r.id}
                          onClick={() => void onApprove(r)}
                        >
                          승인
                        </FormButton>
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          className="button button--secondary"
                          disabled={busyId === r.id}
                          onClick={() => void onReject(r)}
                        >
                          거절
                        </FormButton>
                      </div>
                    ) : status === 'REJECTED' ? (
                      r.rejectReason || '—'
                    ) : (
                      '승인 완료'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {confirmDialog}
    </section>
  )
}
