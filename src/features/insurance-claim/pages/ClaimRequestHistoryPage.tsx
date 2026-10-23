import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import {
  deleteClaimRequest,
  downloadClaimBundle,
  duplicateClaimRequest,
  listClaimRequests,
  type ClaimRequestDraft,
} from '../api/claimRequestsApi'
import InsuranceClaimSubnav from '../components/InsuranceClaimSubnav'
import { formatKstDateDisplay } from '../../../utils/displayDateTime'
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
  const [deletingId, setDeletingId] = useState<number | null>(null)

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

  const remove = async (id: number) => {
    if (!token) {
      return
    }
    const confirmed = window.confirm(
      '이 청구 내역을 삭제하시겠습니까? 생성된 청구서, 동의서, 추가 첨부파일, 서명 파일도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.',
    )
    if (!confirmed) {
      return
    }
    setDeletingId(id)
    try {
      await deleteClaimRequest(token, id)
      setRows((prev) => prev.filter((row) => row.id !== id))
      setMessage('청구 내역이 삭제되었습니다.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '청구 내역 삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  const renderRowActions = (row: ClaimRequestDraft, actionClassName: string) => (
    <div className={actionClassName}>
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
      <FormButton
        htmlType="button"
        variant="danger"
        size="sm"
        disabled={deletingId === row.id}
        onClick={() => void remove(row.id)}
      >
        {deletingId === row.id ? '삭제 중…' : '삭제'}
      </FormButton>
    </div>
  )

  const renderInsuredName = (row: ClaimRequestDraft) => {
    const insuredName = row.insuredSnapshot?.name?.trim() || '수동 입력'
    const isManual = row.customerId == null
    return (
      <>
        {insuredName}
        {isManual ? <span className="insurance-claim-history__manual-tag">수동 입력</span> : null}
      </>
    )
  }

  return (
    <main className="page page--with-back insurance-claim-history insurance-claim-history-page insurance-claim-page">
      <header className="page-header">
        <h1>보험청구</h1>
        <p>청구 내역을 확인하고 새 청구를 작성합니다.</p>
      </header>

      <InsuranceClaimSubnav />

      {message ? (
        <p className="insurance-claim-history__message" role="alert">
          {message}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="insurance-claim-history__empty">아직 작성한 보험청구가 없습니다.</p>
      ) : (
        <>
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
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{renderInsuredName(row)}</td>
                    <td>{row.insuranceCompanyName ?? row.insuranceCompanyId}</td>
                    <td>{formatClaimType(row.claimData?.claimType)}</td>
                    <td>{row.claimData?.treatmentDate || '—'}</td>
                    <td>
                      <span className={statusBadgeClass(row.status)}>{formatStatus(row.status)}</span>
                    </td>
                    <td>{formatKstDateDisplay(row.createdAt, '—')}</td>
                    <td>{renderRowActions(row, 'insurance-claim-history__actions')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="insurance-claim-history__card-list">
            {rows.map((row) => (
              <article key={row.id} className="insurance-claim-history__card">
                <div className="insurance-claim-history__card-row">
                  <span className="insurance-claim-history__card-label">피보험자</span>
                  <span className="insurance-claim-history__card-value">{renderInsuredName(row)}</span>
                </div>
                <div className="insurance-claim-history__card-row">
                  <span className="insurance-claim-history__card-label">보험회사</span>
                  <span className="insurance-claim-history__card-value">
                    {row.insuranceCompanyName ?? row.insuranceCompanyId}
                  </span>
                </div>
                <div className="insurance-claim-history__card-row">
                  <span className="insurance-claim-history__card-label">청구유형</span>
                  <span className="insurance-claim-history__card-value">{formatClaimType(row.claimData?.claimType)}</span>
                </div>
                <div className="insurance-claim-history__card-row">
                  <span className="insurance-claim-history__card-label">진료/사고일자</span>
                  <span className="insurance-claim-history__card-value">{row.claimData?.treatmentDate || '—'}</span>
                </div>
                <div className="insurance-claim-history__card-row">
                  <span className="insurance-claim-history__card-label">상태</span>
                  <span className="insurance-claim-history__card-value">
                    <span className={statusBadgeClass(row.status)}>{formatStatus(row.status)}</span>
                  </span>
                </div>
                <div className="insurance-claim-history__card-row">
                  <span className="insurance-claim-history__card-label">작성일</span>
                  <span className="insurance-claim-history__card-value">{formatKstDateDisplay(row.createdAt, '—')}</span>
                </div>
                {renderRowActions(row, 'insurance-claim-history__card-actions')}
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
