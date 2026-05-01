import { FormButton } from '../../../../components/form'
import type { SendSessionHistoryListItem } from '../contractSignatureHistoryClient'
import { SendSessionStatusBadge } from './SendSessionStatusBadge'
import { formatStaffSessionDate, staffSendSessionDisplayLabel } from '../sendSessionStaffDisplay'

type Props = {
  rows: SendSessionHistoryListItem[]
  busy: boolean
  onDetail: (row: SendSessionHistoryListItem) => void
  onCopyLink: (row: SendSessionHistoryListItem) => void
  onOpenLink: (row: SendSessionHistoryListItem) => void
  onCancel: (row: SendSessionHistoryListItem) => void
}

export function SendSessionHistoryList({ rows, busy, onDetail, onCopyLink, onOpenLink, onCancel }: Props) {
  if (rows.length === 0 && !busy) {
    return <p className="contract-signature-console__empty-state-text">표시할 발송 내역이 없습니다.</p>
  }

  return (
    <div className="contract-signature-console__scroll-x">
      <table className="pdf-engine-table contract-signature-console__table--compact contract-signature-console__table--striped">
        <thead>
          <tr>
            <th>고객</th>
            <th>연락처</th>
            <th>문서</th>
            <th>상태</th>
            <th>진행</th>
            <th>발송일</th>
            <th>완료일</th>
            <th>증빙</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const tpl = row.templateNames.length > 0 ? row.templateNames.join(', ') : '—'
            const req = Math.max(0, row.requiredDocumentCount)
            const done = Math.max(0, row.completedDocumentCount)
            const label = staffSendSessionDisplayLabel(row.status, {
              hasSignedNotCompleted: row.hasSignedNotCompleted,
            })
            return (
              <tr key={row.id}>
                <td>
                  <div>{row.customerName || '—'}</div>
                  {row.customerCode ? (
                    <div className="contract-signature-console__hint">{row.customerCode}</div>
                  ) : null}
                </td>
                <td>{row.maskedPhone || '—'}</td>
                <td>
                  <span title={tpl}>{tpl.length > 36 ? `${tpl.slice(0, 36)}…` : tpl}</span>
                </td>
                <td>
                  <SendSessionStatusBadge
                    sessionStatus={row.status}
                    hasSignedNotCompleted={row.hasSignedNotCompleted}
                  />
                  <div className="contract-signature-console__hint" style={{ marginTop: 4 }}>
                    {label}
                  </div>
                </td>
                <td>
                  {done}/{Math.max(req, row.documentCount)} 완료
                </td>
                <td>{formatStaffSessionDate(row.sentAt ?? row.createdAt)}</td>
                <td>{row.completedAt ? formatStaffSessionDate(row.completedAt) : '—'}</td>
                <td>{row.status === 'completed' && row.evidenceHashPrefix ? row.evidenceHashPrefix : '—'}</td>
                <td>
                  <div className="contract-signature-console__btn-row">
                    <FormButton htmlType="button" variant="primary" size="sm" onClick={() => onDetail(row)}>
                      상세
                    </FormButton>
                    <FormButton
                      htmlType="button"
                      variant="secondary"
                      size="sm"
                      disabled={!row.canCopyLink}
                      onClick={() => onCopyLink(row)}
                    >
                      링크 복사
                    </FormButton>
                    <FormButton
                      htmlType="button"
                      variant="secondary"
                      size="sm"
                      disabled={!row.canOpenLink}
                      onClick={() => onOpenLink(row)}
                    >
                      링크 열기
                    </FormButton>
                    <FormButton
                      htmlType="button"
                      variant="secondary"
                      size="sm"
                      disabled={!row.canCancel || busy}
                      onClick={() => onCancel(row)}
                    >
                      취소
                    </FormButton>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
