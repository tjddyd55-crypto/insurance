import { EmptyState, StatusMessage } from '../../../../components/feedback'
import { FormTextarea } from '../../../../components/form'
import AppDateInput from '../../../../components/common/AppDateInput'
import {
  CUSTOMER_WORKSPACE_ACTION_PRIMARY_CLASS,
} from '../../components/CustomerWorkspaceActionButtons'
import CustomerConsultationContactResultField from '../../components/CustomerConsultationContactResultField'
import CustomerConsultationHistoryList from '../../components/CustomerConsultationHistoryList'
import type { CustomerConsultationsPCViewProps } from './customerConsultationsViewProps'

export default function CustomerConsultationsPagePC({
  error,
  body,
  consultDate,
  contactResult,
  busy,
  rows,
  editingConsultId,
  editConsultDate,
  editConsultBody,
  editContactResult,
  onSetBody,
  onSetConsultDate,
  onSetContactResult,
  onStartEdit,
  onCancelEdit,
  onSetEditConsultDate,
  onSetEditConsultBody,
  onSetEditContactResult,
  onSaveEdit,
  onSubmit,
  onDelete,
  onAddTodoFromConsultation,
}: CustomerConsultationsPCViewProps) {
  const isEditing = editingConsultId != null

  return (
    <div className="content-wrapper page-shell customer-consultations-page customer-consultations-page--pc">
      <StatusMessage message={error} tone="error" className="!mt-0" />

      <section className="customer-consultations-page__section" aria-label="상담 이력">
        {!isEditing ? (
          <form className="customer-consultations-composer" onSubmit={onSubmit}>
            <div className="customer-consultations-composer__toolbar">
              <label className="customer-consultations-composer__field customer-consultations-composer__field--date">
                <span className="customer-consultations-composer__label">상담 일자</span>
                <AppDateInput value={consultDate} onChange={onSetConsultDate} />
              </label>
              <CustomerConsultationContactResultField
                layout="toolbar"
                contactResult={contactResult}
                onContactResultChange={onSetContactResult}
                disabled={busy}
              />
              <div className="customer-consultations-composer__actions">
                <button
                  type="submit"
                  className={CUSTOMER_WORKSPACE_ACTION_PRIMARY_CLASS}
                  disabled={busy}
                >
                  {busy ? '저장 중…' : '상담 추가'}
                </button>
              </div>
            </div>
            <label className="customer-consultations-composer__field customer-consultations-composer__field--body">
              <span className="customer-consultations-composer__label">상담 내용</span>
              <FormTextarea
                className="customer-consultations-composer__textarea"
                value={body}
                onChange={(ev) => onSetBody(ev.target.value)}
                rows={3}
                placeholder="상담 내용을 입력해 주세요."
                maxLength={19500}
              />
            </label>
          </form>
        ) : null}

        <div className="customer-consultations-history">
          {rows.length === 0 ? (
            <EmptyState message="등록된 상담이 없습니다." className="!my-0 !text-left" />
          ) : (
            <CustomerConsultationHistoryList
              rows={rows}
              busy={busy}
              editingConsultId={editingConsultId}
              editConsultDate={editConsultDate}
              editConsultBody={editConsultBody}
              editContactResult={editContactResult}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onSetEditConsultDate={onSetEditConsultDate}
              onSetEditConsultBody={onSetEditConsultBody}
              onSetEditContactResult={onSetEditContactResult}
              onSaveEdit={onSaveEdit}
              onDelete={onDelete}
              onAddTodoFromConsultation={onAddTodoFromConsultation}
            />
          )}
        </div>
      </section>
    </div>
  )
}
