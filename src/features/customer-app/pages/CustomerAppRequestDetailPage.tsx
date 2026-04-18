import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import { getCustomerClaimRequestDetail, type CustomerAppClaimRequestDetail } from '../api/customerAppApi'
import CustomerAppShell from '../components/CustomerAppShell'
import { readCustomerAppSession } from '../session/customerAppSession'

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
  const session = useMemo(() => readCustomerAppSession(), [])
  const [detail, setDetail] = useState<CustomerAppClaimRequestDetail | null>(null)
  const [error, setError] = useState('')
  const parsedRequestId = Number(requestId)
  const hasInvalidRequestId = !Number.isInteger(parsedRequestId) || parsedRequestId < 1

  useEffect(() => {
    if (!session) {
      navigate('/customer-app', { replace: true })
      return
    }
    if (hasInvalidRequestId) {
      return
    }
    let mounted = true
    const run = async () => {
      try {
        const data = await getCustomerClaimRequestDetail(session.appToken, parsedRequestId)
        if (!mounted) {
          return
        }
        setDetail(data)
      } catch (loadError) {
        if (!mounted) {
          return
        }
        setError(loadError instanceof Error ? loadError.message : '요청 상세를 불러오지 못했습니다.')
      }
    }
    void run()
    return () => {
      mounted = false
    }
  }, [hasInvalidRequestId, navigate, parsedRequestId, session])

  return (
    <CustomerAppShell title="요청 상세">
      <StatusMessage message={hasInvalidRequestId ? '잘못된 요청 번호입니다.' : error} tone="error" />
      {!detail ? <div className="text-sm text-[var(--text-secondary)]">불러오는 중…</div> : null}
      {detail ? (
        <div className="space-y-3">
          <div className="text-sm">
            상태 {detail.status} · 접수 {formatDateTime(detail.submittedAt)}
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
            {detail.statusLogs.map((log) => (
              <div key={log.id} className="text-xs text-[var(--text-secondary)]">
                {formatDateTime(log.changedAt)} · {log.fromStatus ?? '초기'} → {log.toStatus} {log.memo ? `(${log.memo})` : ''}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </CustomerAppShell>
  )
}
