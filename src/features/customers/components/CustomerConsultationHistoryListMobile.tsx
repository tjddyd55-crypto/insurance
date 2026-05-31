import { FormButton } from '../../../components/form'
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
            style={{
              borderBottom: '1px solid var(--border-default)',
              padding: '12px 0',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 6,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontWeight: 600 }}>{dateLabel}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  className="filter-button"
                  disabled={busy}
                  onClick={() => onOpenEditModal(r)}
                >
                  수정
                </FormButton>
                <FormButton
                  htmlType="button"
                  variant="action"
                  className="filter-button"
                  disabled={busy}
                  onClick={() => void onDelete(r.id)}
                >
                  삭제
                </FormButton>
                {onAddTodoFromConsultation ? (
                  <FormButton
                    htmlType="button"
                    variant="secondary"
                    className="filter-button"
                    disabled={busy}
                    onClick={() => onAddTodoFromConsultation(r.id, text)}
                  >
                    할 일로 추가
                  </FormButton>
                ) : null}
              </div>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{text || '—'}</div>
            {contactMeta ? (
              <div
                className="customer-consultation-history__contact-meta"
                style={{ marginTop: 8, fontSize: '0.875rem', color: 'var(--text-secondary)' }}
              >
                {contactMeta}
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
