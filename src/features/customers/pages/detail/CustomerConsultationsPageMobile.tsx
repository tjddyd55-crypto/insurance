import { EmptyState, StatusMessage } from '../../../../components/feedback'
import CustomerConsultationHistoryListMobile from '../../components/CustomerConsultationHistoryListMobile'
import {
  CustomerWorkspacePrimaryActionButton,
  CustomerWorkspaceSectionHead,
  CustomerWorkspaceSectionHeadActions,
} from '../../components/CustomerWorkspaceActionButtons'
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
    <div className="content-wrapper page-shell customer-consultations-mobile-shell customer-inline-notes--workspace-mobile">
      <StatusMessage message={listError} tone="error" className="!mt-0" />

      <section style={{ marginTop: 24 }}>
        <CustomerWorkspaceSectionHead
          title="[상담]"
          actions={
            <CustomerWorkspaceSectionHeadActions>
              <CustomerWorkspacePrimaryActionButton disabled={busy} onClick={onOpenAddModal}>
                상담 추가
              </CustomerWorkspacePrimaryActionButton>
            </CustomerWorkspaceSectionHeadActions>
          }
        />

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
