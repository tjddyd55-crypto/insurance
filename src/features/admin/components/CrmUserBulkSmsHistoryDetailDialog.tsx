import { useEffect, useState } from 'react'
import { FormDialog } from '../../../components/dialog'
import { EmptyState, StatusMessage } from '../../../components/feedback'
import { FormButton } from '../../../components/form'
import {
  getCrmUserBulkSmsHistoryDetail,
  type CrmUserBulkSmsCampaign,
} from '../api/crmUserBulkSmsApi'

type RecipientRow = {
  userId: string
  displayName: string
  username: string
  gaCompanyName: string
  role: string
  phoneMasked: string
  status: string
  exclusionReason: string | null
  errorCode: string | null
  sentAt: string | null
}

type Props = {
  open: boolean
  token: string
  campaignId: number | null
  onClose: () => void
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return '—'
  return String(value).slice(0, 19).replace('T', ' ')
}

export default function CrmUserBulkSmsHistoryDetailDialog({
  open,
  token,
  campaignId,
  onClose,
}: Props) {
  const [campaign, setCampaign] = useState<CrmUserBulkSmsCampaign | null>(null)
  const [recipients, setRecipients] = useState<RecipientRow[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || campaignId == null || !token.trim()) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      setCampaign(null)
      setRecipients([])
      try {
        const data = await getCrmUserBulkSmsHistoryDetail(token, campaignId)
        if (cancelled) return
        setCampaign(data.campaign)
        setRecipients(data.recipients)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '발송 상세를 불러오지 못했습니다.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, campaignId, token])

  return (
    <FormDialog
      open={open}
      onClose={() => {
        if (!loading) onClose()
      }}
      title="문자 발송 상세"
      panelClassName="admin-modal-panel admin-user-bulk-sms-history-modal"
      overlayClassName="admin-modal-backdrop"
      closeOnBackdrop={false}
      closeOnEsc={!loading}
      panelPreset="largeForm"
    >
      <div className="admin-modal-content admin-user-bulk-sms-history-modal__body">
        <StatusMessage message={error} tone="error" className="m-0" />
        {loading ? <p className="admin-user-bulk-sms-history-modal__loading">불러오는 중…</p> : null}
        {!loading && campaign ? (
          <>
            <div className="admin-user-bulk-sms-history-modal__summary">
              <p>
                <strong>{campaign.title}</strong>
                {campaign.dryRun ? ' · dry-run' : ''} · {campaign.status} · {campaign.smsType}
              </p>
              <p>
                대상 {campaign.targetCount} · 성공 {campaign.successCount} · 실패{' '}
                {campaign.failedCount} · 제외 {campaign.excludedCount}
              </p>
              <p className="admin-user-bulk-sms-history-modal__meta">
                발신 {campaign.senderNumber || '—'} · 작성{' '}
                {campaign.requestedByDisplayName ||
                  campaign.requestedByUsername ||
                  campaign.requestedBy ||
                  '—'}{' '}
                · {formatWhen(campaign.createdAt)}
              </p>
              {campaign.messageTemplate ? (
                <pre className="admin-user-bulk-sms-history-modal__message">
                  {campaign.messageTemplate}
                </pre>
              ) : null}
            </div>

            {recipients.length === 0 ? (
              <EmptyState
                message="수신자 결과가 없습니다."
                className="m-0 px-1 py-2 text-[var(--text-sub)]"
              />
            ) : (
              <div className="admin-user-bulk-sms-history-modal__table-wrap">
                <table className="admin-data-table admin-user-bulk-sms-history-modal__table">
                  <thead>
                    <tr>
                      <th scope="col">이름</th>
                      <th scope="col">아이디</th>
                      <th scope="col">소속</th>
                      <th scope="col">연락처</th>
                      <th scope="col">결과</th>
                      <th scope="col">사유</th>
                      <th scope="col">시각</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((r) => (
                      <tr key={`${r.userId}-${r.phoneMasked}-${r.status}`}>
                        <td>{r.displayName || '—'}</td>
                        <td>{r.username || '—'}</td>
                        <td>{r.gaCompanyName || '—'}</td>
                        <td>{r.phoneMasked || '—'}</td>
                        <td>{r.status}</td>
                        <td>{r.exclusionReason || r.errorCode || '—'}</td>
                        <td>{formatWhen(r.sentAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </div>
      <div className="admin-modal-actions">
        <FormButton
          htmlType="button"
          variant="secondary"
          className="button button--secondary"
          onClick={onClose}
          disabled={loading}
        >
          닫기
        </FormButton>
      </div>
    </FormDialog>
  )
}
