import { EmptyState, StatusMessage } from '../../../../components/feedback'
import CustomerConsultationHistoryListMobile from '../../components/CustomerConsultationHistoryListMobile'
import {
  CUSTOMER_WORKSPACE_MOBILE_SCOPE_CLASS,
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
    <div
      className={`content-wrapper page-shell customer-consultations-mobile-shell ${CUSTOMER_WORKSPACE_MOBILE_SCOPE_CLASS}`}
    >
      <StatusMessage message={listError} tone="error" className="!mt-0" />

      <div className="customer-consultations-mobile-section">
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
      </div>

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
