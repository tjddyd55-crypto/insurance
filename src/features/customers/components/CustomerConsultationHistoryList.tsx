import { FormInput, FormTextarea } from '../../../components/form'
import {
  CustomerWorkspaceDangerActionButton,
  CustomerWorkspaceItemActions,
  CustomerWorkspacePrimaryActionButton,
  CustomerWorkspaceSecondaryActionButton,
} from './CustomerWorkspaceActionButtons'
import CustomerConsultationContactResultField from './CustomerConsultationContactResultField'
import { formatContactResultMetaLabel } from '../config/customerConsultationFollowUp.config'
import { parseConsultationStoredBody } from '../utils/consultationBodyFormat'
import type { CustomerConsultationRow } from '../api/customerExtraApi'

type CustomerConsultationHistoryListProps = {
  rows: CustomerConsultationRow[]
  busy: boolean
  editingConsultId: number | null
  editConsultDate: string
  editConsultBody: string
  editContactResult: string
  onStartEdit: (row: CustomerConsultationRow) => void
  onCancelEdit: () => void
  onSetEditConsultDate: (value: string) => void
  onSetEditConsultBody: (value: string) => void
  onSetEditContactResult: (value: string) => void
  onSaveEdit: (consultId: number) => void | Promise<void>
  onDelete: (consultId: number) => void | Promise<void>
  onAddTodoFromConsultation?: (consultId: number, plainBody: string) => void
}

export default function CustomerConsultationHistoryList({
  rows,
  busy,
  editingConsultId,
  editConsultDate,
  editConsultBody,
  editContactResult,
  onStartEdit,
  onCancelEdit,
  onSetEditConsultDate,
  onSetEditConsultBody,
  onSetEditContactResult,
  onSaveEdit,
  onDelete,
  onAddTodoFromConsultation,
}: CustomerConsultationHistoryListProps) {
  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {rows.map((r) => {
        const { dateLabel, text } = parseConsultationStoredBody(
          r.body,
          r.createdAt,
          r.consultationDate ?? null,
        )
        const contactMeta = formatContactResultMetaLabel(r)
        const isEditing = editingConsultId === r.id
        return (
          <li
            key={r.id}
            style={{
              borderBottom: '1px solid var(--border-default)',
              padding: '12px 0',
            }}
          >
            {isEditing ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <label style={{ display: 'block' }}>
                  상담 일자{' '}
                  <FormInput
                    type="date"
                    value={editConsultDate}
                    onChange={(ev) => onSetEditConsultDate(ev.target.value)}
                  />
                </label>
                <FormTextarea
                  value={editConsultBody}
                  onChange={(ev) => onSetEditConsultBody(ev.target.value)}
                  rows={4}
                  style={{ width: '100%', padding: 8 }}
                  maxLength={19500}
                />
                <CustomerConsultationContactResultField
                  contactResult={editContactResult}
                  onContactResultChange={onSetEditContactResult}
                  disabled={busy}
                />
                <CustomerWorkspaceItemActions>
                  <CustomerWorkspacePrimaryActionButton disabled={busy} onClick={() => void onSaveEdit(r.id)}>
                    {busy ? '저장 중…' : '저장'}
                  </CustomerWorkspacePrimaryActionButton>
                  <CustomerWorkspaceSecondaryActionButton disabled={busy} onClick={onCancelEdit}>
                    취소
                  </CustomerWorkspaceSecondaryActionButton>
                </CustomerWorkspaceItemActions>
              </div>
            ) : (
              <>
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
                  <CustomerWorkspaceItemActions>
                    <CustomerWorkspaceSecondaryActionButton disabled={busy} onClick={() => onStartEdit(r)}>
                      수정
                    </CustomerWorkspaceSecondaryActionButton>
                    <CustomerWorkspaceDangerActionButton disabled={busy} onClick={() => void onDelete(r.id)}>
                      삭제
                    </CustomerWorkspaceDangerActionButton>
                    {onAddTodoFromConsultation ? (
                      <CustomerWorkspaceSecondaryActionButton
                        disabled={busy}
                        onClick={() => onAddTodoFromConsultation(r.id, text)}
                      >
                        +할일
                      </CustomerWorkspaceSecondaryActionButton>
                    ) : null}
                  </CustomerWorkspaceItemActions>
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
              </>
            )}
          </li>
        )
      })}
    </ul>
  )
}
