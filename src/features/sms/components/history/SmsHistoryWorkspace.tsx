import { useState } from 'react'
import FormButton from '../../../../components/form/FormButton'
import { FormDialog } from '../../../../components/dialog'
import type { SmsModuleViewProps } from '../../hooks/useSmsModuleState'
import type { SmsCampaignSummary } from '../../types/sms.types'

type Props = {
  variant: 'pc' | 'mobile'
  module: Pick<
    SmsModuleViewProps,
    'history' | 'busy' | 'prepareResendFromHistory' | 'navigateToSend' | 'setTab'
  >
}

function formatSendMode(item: SmsCampaignSummary): string {
  if (item.scheduledAt) {
    return '예약'
  }
  return '즉시'
}

function detectMessageTransport(message: string): 'SMS' | 'LMS' {
  const bytes = new TextEncoder().encode(message).length
  return bytes > 90 ? 'LMS' : 'SMS'
}

export default function SmsHistoryWorkspace({ variant, module }: Props) {
  const { history, busy, prepareResendFromHistory, navigateToSend, setTab } = module
  const [detailItem, setDetailItem] = useState<SmsCampaignSummary | null>(null)

  const handleResend = (item: SmsCampaignSummary) => {
    prepareResendFromHistory(item)
    setTab('send')
    navigateToSend({ mode: item.scheduledAt ? 'reserved' : 'immediate' })
    setDetailItem(null)
  }

  const handleCopyToSend = (item: SmsCampaignSummary) => {
    prepareResendFromHistory(item)
    setTab('send')
    navigateToSend({ mode: 'immediate' })
    setDetailItem(null)
  }

  return (
    <>
      <section className={`sms-history-workspace sms-history-workspace--${variant}`}>
        <h2 className="sms-history-workspace__title">발송내역</h2>
        {history.length === 0 ? (
          <p className="sms-module__muted">발송 이력이 없습니다.</p>
        ) : (
          <div className="sms-history-table-wrap">
            <table className="sms-history-table">
              <thead>
                <tr>
                  <th>발송일시</th>
                  <th>방식</th>
                  <th>제목</th>
                  <th>대상</th>
                  <th>성공</th>
                  <th>실패</th>
                  <th>제외</th>
                  <th>유형</th>
                  <th>상태</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.sentAt ?? item.createdAt).toLocaleString('ko-KR', { hour12: false })}</td>
                    <td>{formatSendMode(item)}</td>
                    <td>{item.title}</td>
                    <td>{item.targetCount}명</td>
                    <td>{item.successCount}</td>
                    <td>{item.failCount}</td>
                    <td>{item.skippedCount}</td>
                    <td>{detectMessageTransport(item.message)}</td>
                    <td>{item.status}</td>
                    <td>
                      <div className="sms-history-table__actions">
                        <FormButton type="button" variant="secondary" disabled={busy} onClick={() => setDetailItem(item)}>
                          상세
                        </FormButton>
                        <FormButton type="button" variant="secondary" disabled={busy} onClick={() => handleResend(item)}>
                          재발송
                        </FormButton>
                        <FormButton type="button" variant="secondary" disabled={busy} onClick={() => handleCopyToSend(item)}>
                          복사
                        </FormButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <FormDialog
        open={detailItem != null}
        onClose={() => setDetailItem(null)}
        title="발송내역 상세"
        footer={
          <div className="sms-template-dialog__actions">
            <FormButton type="button" variant="secondary" onClick={() => setDetailItem(null)}>
              닫기
            </FormButton>
            {detailItem ? (
              <>
                <FormButton type="button" variant="secondary" disabled={busy} onClick={() => handleResend(detailItem)}>
                  재발송 준비
                </FormButton>
                <FormButton type="button" disabled={busy} onClick={() => handleCopyToSend(detailItem)}>
                  복사해서 발송
                </FormButton>
              </>
            ) : null}
          </div>
        }
      >
        {detailItem ? (
          <dl className="sms-history-detail">
            <div>
              <dt>발송 제목</dt>
              <dd>{detailItem.title}</dd>
            </div>
            <div>
              <dt>발송 방식</dt>
              <dd>{formatSendMode(detailItem)}</dd>
            </div>
            <div>
              <dt>대상 인원</dt>
              <dd>{detailItem.targetCount}명</dd>
            </div>
            <div>
              <dt>성공 / 실패 / 제외</dt>
              <dd>
                {detailItem.successCount} / {detailItem.failCount} / {detailItem.skippedCount}
              </dd>
            </div>
            <div>
              <dt>발송 시간</dt>
              <dd>{new Date(detailItem.sentAt ?? detailItem.createdAt).toLocaleString('ko-KR', { hour12: false })}</dd>
            </div>
            <div>
              <dt>문자 유형</dt>
              <dd>{detectMessageTransport(detailItem.message)}</dd>
            </div>
            <div>
              <dt>상태</dt>
              <dd>{detailItem.status}</dd>
            </div>
            <div>
              <dt>문자 내용</dt>
              <dd>
                <pre className="sms-history-detail__body">{detailItem.message}</pre>
              </dd>
            </div>
          </dl>
        ) : null}
      </FormDialog>
    </>
  )
}
