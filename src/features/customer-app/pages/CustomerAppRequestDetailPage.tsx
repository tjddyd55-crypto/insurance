import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import { FormButton } from '../../../components/form'
import { getCustomerClaimRequestDetail, type CustomerAppClaimRequestDetail } from '../api/customerAppApi'
import CustomerAppShell from '../components/CustomerAppShell'
import { useCustomerAppSession } from '../session/useCustomerAppSession'
import { resolveClaimStatusMeta } from '../utils/claimStatus'

function formatDateTime(iso: string | null): string {
  if (!iso) {
    return '—'
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function CustomerAppRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const navigate = useNavigate()
  const session = useCustomerAppSession()
  const [detail, setDetail] = useState<CustomerAppClaimRequestDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const parsedRequestId = Number(requestId)
  const hasInvalidRequestId = !Number.isInteger(parsedRequestId) || parsedRequestId < 1

  const loadDetail = useCallback(async (token: string, id: number) => {
    setLoading(true)
    try {
      const data = await getCustomerClaimRequestDetail(token, id)
      setDetail(data)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '요청 상세를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!session) {
      navigate('/customer-app', { replace: true })
      return
    }
    if (hasInvalidRequestId) {
      return
    }
    let active = true
    const run = async () => {
      if (!active) {
        return
      }
      await loadDetail(session.appToken, parsedRequestId)
    }
    void run()
    const timer = window.setInterval(() => {
      void run()
    }, 10000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [hasInvalidRequestId, loadDetail, navigate, parsedRequestId, session])

  return (
    <CustomerAppShell title="요청 상세">
      <StatusMessage message={hasInvalidRequestId ? '잘못된 요청 번호입니다.' : error} tone="error" />
      {!detail && loading ? <div className="text-sm text-[var(--text-secondary)]">불러오는 중…</div> : null}
      {detail ? (
        <div className="space-y-3">
          <div className="text-sm flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${resolveClaimStatusMeta(detail.status).className}`}
            >
              {resolveClaimStatusMeta(detail.status).label}
            </span>
            <span className="text-[var(--text-secondary)]">접수 {formatDateTime(detail.submittedAt)}</span>
            <FormButton
              htmlType="button"
              variant="secondary"
              className="!h-auto !py-1 !px-2 text-[11px]"
              onClick={() => {
                if (!session || hasInvalidRequestId) {
                  return
                }
                void loadDetail(session.appToken, parsedRequestId)
              }}
              loading={loading}
            >
              상태 새로고침
            </FormButton>
          </div>
          <div className="text-sm font-medium">{detail.title || '(제목 없음)'}</div>
          {detail.memo ? <div className="text-sm whitespace-pre-wrap">{detail.memo}</div> : null}
          <div className="space-y-1">
            <div className="text-sm font-semibold">첨부 파일</div>
            {detail.files.length === 0 ? (
              <div className="text-xs text-[var(--text-secondary)]">첨부 파일이 없습니다.</div>
            ) : (
              detail.files.map((file) => (
                <a
                  key={file.id}
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs text-blue-600"
                >
                  {file.fileName}
                </a>
              ))
            )}
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold">상태 이력</div>
            {detail.statusLogs.length === 0 ? (
              <div className="text-xs text-[var(--text-secondary)]">상태 이력이 없습니다.</div>
            ) : (
              detail.statusLogs.map((log) => (
                <div key={log.id} className="text-xs text-[var(--text-secondary)]">
                  {formatDateTime(log.changedAt)} · {log.fromStatus ? resolveClaimStatusMeta(log.fromStatus).label : '초기'} →{' '}
                  {resolveClaimStatusMeta(log.toStatus).label} {log.memo ? `(${log.memo})` : ''}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </CustomerAppShell>
  )
}
