import { EmptyState, StatusMessage } from '../../../../components/feedback'
import { FormButton } from '../../../../components/form'
import CustomerConsultationHistoryListMobile from '../../components/CustomerConsultationHistoryListMobile'
import CustomerConsultationFormModal from '../../components/mobile/CustomerConsultationFormModal'
import type { CustomerConsultationsMobileViewProps } from './customerConsultationsViewProps'

export default function CustomerConsultationsPageMobile({
  listError,
  formError,
  busy,
  rows,
  formModalOpen,
  formModalTitle,
  formConsultDate,
  formBody,
  formContactResult,
  onOpenAddModal,
  onOpenEditModal,
  onCloseFormModal,
  onSetFormConsultDate,
  onSetFormBody,
  onSetFormContactResult,
  onSaveForm,
  onDelete,
  onAddTodoFromConsultation,
}: CustomerConsultationsMobileViewProps) {
  return (
    <div className="content-wrapper page-shell customer-consultations-mobile-shell">
      <StatusMessage message={listError} tone="error" className="!mt-0" />

      <section style={{ marginTop: 24 }}>
        <div className="customer-consultations-mobile-shell__section-head">
          <div className="customer-section-title !mt-0">[상담]</div>
          <FormButton
            htmlType="button"
            variant="action"
            className="customer-workspace-action-button customer-workspace-action-button--primary"
            disabled={busy}
            onClick={onOpenAddModal}
          >
            상담 추가
          </FormButton>
        </div>

        {rows.length === 0 ? (
          <EmptyState message="등록된 상담이 없습니다." className="!my-0 !text-left" />
        ) : (
          <CustomerConsultationHistoryListMobile
            rows={rows}
            busy={busy}
            onOpenEditModal={onOpenEditModal}
            onDelete={onDelete}
            onAddTodoFromConsultation={onAddTodoFromConsultation}
          />
        )}
      </section>

      <CustomerConsultationFormModal
        open={formModalOpen}
        title={formModalTitle}
        consultDate={formConsultDate}
        body={formBody}
        contactResult={formContactResult}
        error={formError}
        busy={busy}
        onConsultDateChange={onSetFormConsultDate}
        onBodyChange={onSetFormBody}
        onContactResultChange={onSetFormContactResult}
        onSave={onSaveForm}
        onCancel={onCloseFormModal}
      />
    </div>
  )
}
