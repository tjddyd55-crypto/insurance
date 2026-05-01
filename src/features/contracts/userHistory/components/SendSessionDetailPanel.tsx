import { FormButton } from '../../../../components/form'
import type { SendSessionDetail } from '../../testConsole/contractSignatureTestConsoleClient'
import { downloadStaffSignedPdfFile } from '../../testConsole/contractSignatureTestConsoleClient'
import { buildCustomerPublicSignUrl } from '../contractSignatureHistoryClient'
import { SendSessionStatusBadge } from './SendSessionStatusBadge'
import { formatStaffSessionDate, staffDocumentStatusLabel, staffSendSessionDisplayLabel } from '../sendSessionStaffDisplay'
import { ContractTableDateCell, ContractTableHashCell } from './ContractTableCells'

type Props = {
  open: boolean
  detail: SendSessionDetail | null
  loading: boolean
  error: string | null
  token: string
  listHints?: { hasSignedNotCompleted?: boolean } | null
  onClose: () => void
  onRefresh: () => void
  onCancelSession: () => void
  cancelBusy: boolean
  onCopyLink: (linkCode: string) => void
  onOpenLink: (linkCode: string) => void
}

export function SendSessionDetailPanel({
  open,
  detail,
  loading,
  error,
  token,
  listHints,
  onClose,
  onRefresh,
  onCancelSession,
  cancelBusy,
  onCopyLink,
  onOpenLink,
}: Props) {
  if (!open) {
    return null
  }

  const linkCode = detail?.linkCode ?? ''
  const publicUrl = linkCode ? buildCustomerPublicSignUrl(linkCode) : ''
  const sessionSt = detail?.status ?? ''
  const hasCompletedDoc = detail?.documents?.some((d) => d.status === 'completed') ?? false
  const canCancel =
    detail != null && !['completed', 'cancelled', 'expired'].includes(String(sessionSt)) && !hasCompletedDoc
  const derivedSignedPending = detail?.documents?.some((d) => d.status === 'signed') ?? false
  const signedHint = listHints?.hasSignedNotCompleted ?? derivedSignedPending

  return (
    <div
      className="contract-signature-console__detail-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="발송 세션 상세"
    >
      <div className="contract-signature-console__detail-dialog">
        <h2 className="contract-signature-console__section-title">발송 세션 상세</h2>
        {error ? (
          <div className="contract-signature-console__alert--danger" role="alert">
            {error}
          </div>
        ) : null}
        {loading && !detail ? <p className="contract-signature-console__hint">불러오는 중…</p> : null}
        {detail ? (
          <>
            <p className="contract-signature-console__hint">
              고객: {detail.customerName ?? '—'}{' '}
              {detail.customerCode ? <span>({detail.customerCode})</span> : null}
            </p>
            <p className="contract-signature-console__hint">마스킹 연락처: {detail.maskedPhone ?? '—'}</p>
            <p className="contract-signature-console__hint">
              발송 링크:{' '}
              <code style={{ fontSize: 12, wordBreak: 'break-all' }} title={publicUrl}>
                {publicUrl}
              </code>
            </p>
            <p className="contract-signature-console__hint">
              세션 상태:{' '}
              <SendSessionStatusBadge sessionStatus={detail.status} hasSignedNotCompleted={signedHint} />{' '}
              <span className="contract-signature-console__hint">
                (
                {staffSendSessionDisplayLabel(detail.status, {
                  hasSignedNotCompleted: signedHint,
                })}
                )
              </span>
            </p>
            <p className="contract-signature-console__hint">
              인증 상태: {detail.identityStatus ?? '—'}
              {detail.identityVerifiedAt ? ` · ${formatStaffSessionDate(detail.identityVerifiedAt)}` : ''}
            </p>
            <p className="contract-signature-console__hint">
              열람: {detail.openedAt ? formatStaffSessionDate(detail.openedAt) : '—'}
            </p>

            <h3 className="contract-signature-console__section-title" style={{ marginTop: 12 }}>
              문서 목록
            </h3>
            <div className="contract-signature-console__session-doc-table-wrap">
              <table className="contract-session-doc-table">
                <colgroup>
                  <col style={{ width: '170px' }} />
                  <col style={{ width: '86px' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '108px' }} />
                  <col style={{ width: '96px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="contract-table-cell-left">문서</th>
                    <th className="contract-table-cell-center">상태</th>
                    <th className="contract-table-cell-center">서명</th>
                    <th className="contract-table-cell-center">완료</th>
                    <th className="contract-table-cell-center">증빙</th>
                    <th className="contract-table-cell-center">최종 PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.documents ?? []).map((d) => {
                    const ev = d.evidence
                    const canDl = d.status === 'completed' && Boolean(ev?.hasSignedPdfFile)
                    const docLabel = staffDocumentStatusLabel(d.status)
                    return (
                      <tr key={d.id}>
                        <td className="contract-table-cell-left">
                          <div className="contract-table-document" title={d.titleSnapshot}>
                            {d.titleSnapshot}
                          </div>
                        </td>
                        <td className="contract-table-cell-center">
                          <span
                            className="contract-signature-console__status-badge contract-status-badge contract-status-badge--doc"
                            data-doc-status={d.status}
                          >
                            {docLabel}
                          </span>
                        </td>
                        <td className="contract-table-cell-center">
                          <ContractTableDateCell iso={ev?.signedAt ?? null} />
                        </td>
                        <td className="contract-table-cell-center">
                          <ContractTableDateCell iso={d.completedAt} />
                        </td>
                        <td className="contract-table-cell-center">
                          <ContractTableHashCell prefix={ev?.evidenceHashPrefix ?? null} />
                        </td>
                        <td className="contract-table-cell-center">
                          <div className="contract-session-doc-dl-wrap">
                            {canDl ? (
                              <FormButton
                                htmlType="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => void downloadStaffSignedPdfFile(token, detail.id, d.id)}
                              >
                                다운로드
                              </FormButton>
                            ) : d.status === 'completed' ? (
                              <span className="contract-signature-console__hint contract-session-doc-pending">
                                준비 중
                              </span>
                            ) : (
                              <span className="contract-table-empty">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        <div className="session-modal-actions">
          <div className="session-modal-actions__left">
            <FormButton htmlType="button" variant="secondary" size="sm" disabled={!linkCode} onClick={() => onCopyLink(linkCode)}>
              링크 복사
            </FormButton>
            <FormButton htmlType="button" variant="secondary" size="sm" disabled={!linkCode} onClick={() => onOpenLink(linkCode)}>
              링크 열기
            </FormButton>
            <FormButton htmlType="button" variant="primary" size="sm" disabled={loading || !detail} onClick={onRefresh}>
              상태 새로고침
            </FormButton>
          </div>
          <div className="session-modal-actions__right">
            <FormButton
              htmlType="button"
              variant="secondary"
              size="sm"
              disabled={!canCancel || cancelBusy}
              onClick={onCancelSession}
            >
              취소
            </FormButton>
            <FormButton htmlType="button" variant="secondary" size="sm" onClick={onClose}>
              닫기
            </FormButton>
          </div>
        </div>
      </div>
    </div>
  )
}
