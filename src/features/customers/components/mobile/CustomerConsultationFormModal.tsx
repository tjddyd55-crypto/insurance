import Modal from '../../../../components/ui/Modal'
import { StatusMessage } from '../../../../components/feedback'
import { FormInput, FormTextarea } from '../../../../components/form'
import AppDateInput from '../../../../components/common/AppDateInput'
import CustomerConsultationContactResultField from '../CustomerConsultationContactResultField'
import { CustomerWorkspaceMobileScope } from '../CustomerWorkspaceActionButtons'
import {
  CUSTOMER_WORKSPACE_FORM_TEXTAREA_CLASS,
  CustomerWorkspaceFormModalFooter,
} from '../CustomerWorkspaceFormModalFooter'

const CONSULTATION_FORM_MODAL_PANEL_CLASS = 'max-w-lg w-[92vw] customer-workspace-form-modal'

type CustomerConsultationFormModalProps = {
  open: boolean
  title: '상담 추가' | '상담 수정'
  consultDate: string
  body: string
  contactResult: string
  error: string
  busy: boolean
  onConsultDateChange: (value: string) => void
  onBodyChange: (value: string) => void
  onContactResultChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
}

export default function CustomerConsultationFormModal({
  open,
  title,
  consultDate,
  body,
  contactResult,
  error,
  busy,
  onConsultDateChange,
  onBodyChange,
  onContactResultChange,
  onSave,
  onCancel,
}: CustomerConsultationFormModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      ariaLabel={title}
      closeOnBackdrop={false}
      onEscapeRequest={onCancel}
      panelClassName={CONSULTATION_FORM_MODAL_PANEL_CLASS}
    >
      <CustomerWorkspaceMobileScope>
        <div className="text-lg font-semibold mb-2 text-[var(--text-primary)]">{title}</div>
        <StatusMessage message={error} tone="error" className="!mt-0 !mb-3" />
        <div
          className="customer-consultation-form-modal__body"
          style={{ display: 'grid', gap: 12, maxHeight: 'min(70vh, 520px)', overflowY: 'auto' }}
        >
          <label style={{ display: 'block' }}>
            <span className="block mb-1 text-[var(--text-secondary)]">상담일</span>
            <AppDateInput
              value={consultDate}
              onChange={onConsultDateChange}
              disabled={busy}
            />
          </label>
          <label style={{ display: 'block' }}>
            <span className="block mb-1 text-[var(--text-secondary)]">상담 내용</span>
            <FormTextarea
              className={CUSTOMER_WORKSPACE_FORM_TEXTAREA_CLASS}
              value={body}
              onChange={(ev) => onBodyChange(ev.target.value)}
              rows={4}
              placeholder="상담 내용"
              maxLength={19500}
              disabled={busy}
            />
          </label>
          <CustomerConsultationContactResultField
            contactResult={contactResult}
            onContactResultChange={onContactResultChange}
            disabled={busy}
          />
        </div>
        <CustomerWorkspaceFormModalFooter
          onCancel={onCancel}
          onSave={onSave}
          busy={busy}
          saveDisabled={!body.trim()}
        />
      </CustomerWorkspaceMobileScope>
    </Modal>
  )
}
