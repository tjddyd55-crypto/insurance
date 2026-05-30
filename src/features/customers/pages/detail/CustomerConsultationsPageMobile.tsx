import { EmptyState, StatusMessage } from '../../../../components/feedback'
import { FormButton, FormInput, FormTextarea } from '../../../../components/form'
import CustomerConsultationFollowUpFields from '../../components/CustomerConsultationFollowUpFields'
import CustomerConsultationHistoryList from '../../components/CustomerConsultationHistoryList'
import type { CustomerConsultationsViewProps } from './customerConsultationsViewProps'

export default function CustomerConsultationsPageMobile({
  error,
  body,
  consultDate,
  contactResult,
  followUpStatus,
  nextContactDate,
  followUpNote,
  busy,
  rows,
  editingConsultId,
  editConsultDate,
  editConsultBody,
  editContactResult,
  editFollowUpStatus,
  editNextContactDate,
  editFollowUpNote,
  onSetBody,
  onSetConsultDate,
  onSetContactResult,
  onSetFollowUpStatus,
  onSetNextContactDate,
  onSetFollowUpNote,
  onStartEdit,
  onCancelEdit,
  onSetEditConsultDate,
  onSetEditConsultBody,
  onSetEditContactResult,
  onSetEditFollowUpStatus,
  onSetEditNextContactDate,
  onSetEditFollowUpNote,
  onSaveEdit,
  onSubmit,
  onDelete,
  onAddTodoFromConsultation,
}: CustomerConsultationsViewProps) {
  return (
    <div className="content-wrapper page-shell">
      <StatusMessage message={error} tone="error" className="!mt-0" />

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: '1.05rem' }}>상담 기록</h2>
        <form onSubmit={onSubmit} style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>
            상담 일자{' '}
            <FormInput type="date" value={consultDate} onChange={(ev) => onSetConsultDate(ev.target.value)} />
          </label>
          <FormTextarea
            value={body}
            onChange={(ev) => onSetBody(ev.target.value)}
            rows={4}
            style={{ width: '100%', padding: 8 }}
            placeholder="상담 내용"
            maxLength={19500}
          />
          <CustomerConsultationFollowUpFields
            contactResult={contactResult}
            followUpStatus={followUpStatus}
            nextContactDate={nextContactDate}
            followUpNote={followUpNote}
            onContactResultChange={onSetContactResult}
            onFollowUpStatusChange={onSetFollowUpStatus}
            onNextContactDateChange={onSetNextContactDate}
            onFollowUpNoteChange={onSetFollowUpNote}
            disabled={busy}
          />
          <FormButton htmlType="submit" variant="action" disabled={busy} style={{ marginTop: 8 }}>
            {busy ? '저장 중…' : '상담 추가'}
          </FormButton>
        </form>
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
            editFollowUpStatus={editFollowUpStatus}
            editNextContactDate={editNextContactDate}
            editFollowUpNote={editFollowUpNote}
            onStartEdit={onStartEdit}
            onCancelEdit={onCancelEdit}
            onSetEditConsultDate={onSetEditConsultDate}
            onSetEditConsultBody={onSetEditConsultBody}
            onSetEditContactResult={onSetEditContactResult}
            onSetEditFollowUpStatus={onSetEditFollowUpStatus}
            onSetEditNextContactDate={onSetEditNextContactDate}
            onSetEditFollowUpNote={onSetEditFollowUpNote}
            onSaveEdit={onSaveEdit}
            onDelete={onDelete}
            onAddTodoFromConsultation={onAddTodoFromConsultation}
          />
        )}
      </section>
    </div>
  )
}
