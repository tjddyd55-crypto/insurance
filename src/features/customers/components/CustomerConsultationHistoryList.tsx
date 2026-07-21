import { FormTextarea } from '../../../components/form'
import AppDateInput from '../../../components/common/AppDateInput'
import {
  CustomerWorkspaceDangerActionButton,
  CustomerWorkspaceItemActions,
  CustomerWorkspacePrimaryActionButton,
  CustomerWorkspaceSecondaryActionButton,
} from './CustomerWorkspaceActionButtons'
import CustomerConsultationContactResultField from './CustomerConsultationContactResultField'
import { formatContactResultMetaLabel } from '../config/customerConsultationFollowUp.config'
import { parseConsultationStoredBody } from '../utils/consultationBodyFormat'
import { formatDateWithKoreanWeekday } from '../../../utils/formatDateWithKoreanWeekday'
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
    <ul className="customer-consultations-history__list">
      {rows.map((r) => {
        const { dateLabel, text } = parseConsultationStoredBody(
          r.body,
          r.createdAt,
          r.consultationDate ?? null,
        )
        const dateDisplay = formatDateWithKoreanWeekday(dateLabel)
        const contactMeta = formatContactResultMetaLabel(r)
        const isEditing = editingConsultId === r.id
        return (
          <li key={r.id} className="customer-consultations-history__item">
            {isEditing ? (
              <div className="customer-consultations-history__edit">
                <div className="customer-consultations-history__edit-row">
                  <label className="customer-consultations-composer__field customer-consultations-composer__field--date">
                    <span className="customer-consultations-composer__label">상담 일자</span>
                    <AppDateInput value={editConsultDate} onChange={onSetEditConsultDate} />
                  </label>
                  <CustomerConsultationContactResultField
                    layout="toolbar"
                    contactResult={editContactResult}
                    onContactResultChange={onSetEditContactResult}
                    disabled={busy}
                  />
                </div>
                <label className="customer-consultations-composer__field customer-consultations-composer__field--body">
                  <span className="customer-consultations-composer__label">상담 내용</span>
                  <FormTextarea
                    className="customer-consultations-composer__textarea"
                    value={editConsultBody}
                    onChange={(ev) => onSetEditConsultBody(ev.target.value)}
                    rows={3}
                    maxLength={19500}
                  />
                </label>
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
                <div className="customer-consultations-history__item-head">
                  <div className="customer-consultations-history__date">{dateDisplay}</div>
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
                <div className="customer-consultations-history__body">{text || '—'}</div>
                {contactMeta ? (
                  <div className="customer-consultations-history__contact-meta">{contactMeta}</div>
                ) : null}
              </>
            )}
          </li>
        )
      })}
    </ul>
  )
}
