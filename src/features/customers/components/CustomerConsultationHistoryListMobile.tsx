import {
  CustomerWorkspaceDangerActionButton,
  CustomerWorkspaceItemActions,
  CustomerWorkspaceSecondaryActionButton,
} from './CustomerWorkspaceActionButtons'
import { formatContactResultMetaLabel } from '../config/customerConsultationFollowUp.config'
import { parseConsultationStoredBody } from '../utils/consultationBodyFormat'
import type { CustomerConsultationRow } from '../api/customerExtraApi'

type CustomerConsultationHistoryListMobileProps = {
  rows: CustomerConsultationRow[]
  busy: boolean
  onOpenEditModal: (row: CustomerConsultationRow) => void
  onDelete: (consultId: number) => void | Promise<void>
  onAddTodoFromConsultation?: (consultId: number, plainBody: string) => void
}

export default function CustomerConsultationHistoryListMobile({
  rows,
  busy,
  onOpenEditModal,
  onDelete,
  onAddTodoFromConsultation,
}: CustomerConsultationHistoryListMobileProps) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
      {rows.map((r) => {
        const { dateLabel, text } = parseConsultationStoredBody(
          r.body,
          r.createdAt,
          r.consultationDate ?? null,
        )
        const contactMeta = formatContactResultMetaLabel(r)
        return (
          <li
            key={r.id}
            className="customer-consultation-item customer-consultation-item--mobile customer-inline-memo-row customer-inline-memo-row--workspace-mobile"
            style={{
              borderBottom: '1px solid var(--border-default)',
              padding: '12px 0',
            }}
          >
            <div className="customer-consultation-item__date">{dateLabel}</div>
            <div className="customer-consultation-item__body">{text || '—'}</div>
            {contactMeta ? (
              <div
                className="customer-consultation-history__contact-meta customer-consultation-item__meta"
                style={{ marginTop: 8, fontSize: '0.875rem', color: 'var(--text-secondary)' }}
              >
                {contactMeta}
              </div>
            ) : null}
            <CustomerWorkspaceItemActions>
              <CustomerWorkspaceSecondaryActionButton disabled={busy} onClick={() => onOpenEditModal(r)}>
                수정
              </CustomerWorkspaceSecondaryActionButton>
              <CustomerWorkspaceDangerActionButton disabled={busy} onClick={() => void onDelete(r.id)}>
                삭제
              </CustomerWorkspaceDangerActionButton>
              {onAddTodoFromConsultation ? (
                <CustomerWorkspaceSecondaryActionButton
                  aria-label="할 일로 추가"
                  title="할 일로 추가"
                  disabled={busy}
                  onClick={() => onAddTodoFromConsultation(r.id, text)}
                >
                  할 일로 추가
                </CustomerWorkspaceSecondaryActionButton>
              ) : null}
            </CustomerWorkspaceItemActions>
          </li>
        )
      })}
    </ul>
  )
}
