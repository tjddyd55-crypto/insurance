import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import {
  downloadClaimBundle,
  duplicateClaimRequest,
  listClaimRequests,
  type ClaimRequestDraft,
} from '../api/claimRequestsApi'
import '../insurance-claim-form.css'

const CLAIM_TYPE_LABELS: Record<string, string> = {
  disease: '질병',
  injury: '상해',
  traffic: '교통사고',
}

const STATUS_LABELS: Record<string, string> = {
  draft: '초안',
  generated: '생성 완료',
  completed: '완료',
  failed: '실패',
}

function formatClaimType(raw: string | undefined): string {
  const key = String(raw ?? '').trim()
  return CLAIM_TYPE_LABELS[key] ?? (key || '—')
}

function formatStatus(status: string): string {
  return STATUS_LABELS[status] ?? status
}

function statusBadgeClass(status: string): string {
  if (status === 'draft') {
    return 'insurance-claim-history__badge insurance-claim-history__badge--draft'
  }
  if (status === 'generated' || status === 'completed') {
    return 'insurance-claim-history__badge insurance-claim-history__badge--generated'
  }
  if (status === 'failed') {
    return 'insurance-claim-history__badge insurance-claim-history__badge--failed'
  }
  return 'insurance-claim-history__badge'
}

export default function ClaimRequestHistoryPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<ClaimRequestDraft[]>([])
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!token) {
      return
    }
    try {
      const res = await listClaimRequests(token)
      setRows(res.requests)
      setMessage('')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '청구 내역을 불러오지 못했습니다.')
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const duplicate = async (id: number) => {
    if (!token) {
      return
    }
    setBusyId(id)
    try {
      const { request } = await duplicateClaimRequest(token, id)
      navigate(`/insurance-claim/requests/${request.id}`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '다시 청구하기에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  const download = async (id: number) => {
    if (!token) {
      return
    }
    setDownloadingId(id)
    try {
      await downloadClaimBundle(token, id)
      setMessage('')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '다운로드에 실패했습니다.')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <main className="page page--with-back insurance-claim-history">
      <header className="page-header">
        <h1>보험청구</h1>
        <p>청구 내역을 확인하고 새 청구를 작성합니다.</p>
      </header>

      <div className="insurance-claim-history__toolbar">
        <Link className="button button--primary" to="/insurance-claim/new">
          새 청구
        </Link>
      </div>

      {message ? (
        <p className="insurance-claim-history__message" role="alert">
          {message}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="insurance-claim-history__empty">아직 작성한 보험청구가 없습니다.</p>
      ) : (
        <div className="insurance-claim-history__table-wrap">
          <table className="insurance-claim-history__table">
            <thead>
              <tr>
                <th>피보험자</th>
                <th>보험회사</th>
                <th>청구유형</th>
                <th>진료/사고일자</th>
                <th>상태</th>
                <th>작성일</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const insuredName = row.insuredSnapshot?.name?.trim() || '수동 입력'
                const isManual = row.customerId == null
                return (
                  <tr key={row.id}>
                    <td>
                      {insuredName}
                      {isManual ? (
                        <span className="insurance-claim-history__manual-tag">수동 입력</span>
                      ) : null}
                    </td>
                    <td>{row.insuranceCompanyName ?? row.insuranceCompanyId}</td>
                    <td>{formatClaimType(row.claimData?.claimType)}</td>
                    <td>{row.claimData?.treatmentDate || '—'}</td>
                    <td>
                      <span className={statusBadgeClass(row.status)}>{formatStatus(row.status)}</span>
                    </td>
                    <td>{String(row.createdAt ?? '').slice(0, 10) || '—'}</td>
                    <td>
                      <div className="insurance-claim-history__actions">
                        <Link className="button button--secondary" to={`/insurance-claim/requests/${row.id}`}>
                          상세보기
                        </Link>
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          size="sm"
                          disabled={busyId === row.id}
                          onClick={() => void duplicate(row.id)}
                        >
                          다시 청구하기
                        </FormButton>
                        {row.status !== 'draft' ? (
                          <FormButton
                            htmlType="button"
                            variant="secondary"
                            size="sm"
                            disabled={downloadingId === row.id}
                            onClick={() => void download(row.id)}
                          >
                            {downloadingId === row.id ? '다운로드 중…' : '다운로드'}
                          </FormButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
