import { useCallback, useState } from 'react'
import { useAuth } from '../../../auth/AuthProvider'
import CustomerWorkspaceCloseButton from '../CustomerWorkspaceCloseButton'
import { useMobileConsultationsState } from '../../hooks/useMobileConsultationsState'
import CustomerConsultationsPageMobile from '../../pages/detail/CustomerConsultationsPageMobile'
import type { CustomerConsultationRow } from '../../api/customerExtraApi'
import { TodoEditorDialog, type TodoCreatePrefill } from '../../../todos/components/TodoEditorDialog'
import { firstLineTodoTitle } from '../../../todos/utils/todoCopy'
import { suggestDueDateFromText } from '../../../todos/utils/suggestDueDateFromText'

type CustomerConsultationsModalProps = {
  customerId: number
  onCreated?: (row: CustomerConsultationRow) => void
  onDeleted?: (consultId: number) => void
  onClose: () => void
}

export default function CustomerConsultationsModal({
  customerId,
  onCreated,
  onDeleted,
  onClose,
}: CustomerConsultationsModalProps) {
  const { token, user } = useAuth()
  const gaIdNumeric =
    user?.gaId != null && Number.isFinite(Number(user.gaId)) ? Number(user.gaId) : null

  const { mobileViewProps, confirmDialog, closeFormModal } = useMobileConsultationsState(
    customerId,
    token,
    { onCreated, onDeleted },
  )

  const [todoDialogOpen, setTodoDialogOpen] = useState(false)
  const [todoDialogSession, setTodoDialogSession] = useState(0)
  const [todoPrefill, setTodoPrefill] = useState<TodoCreatePrefill | null>(null)

  const handleWorkspaceClose = useCallback(() => {
    closeFormModal()
    onClose()
  }, [closeFormModal, onClose])

  const openTodoFromConsultation = useCallback(
    (consultId: number, plainBody: string) => {
      const bodyText = plainBody.trim() || '(상담 내용 없음)'
      setTodoPrefill({
        sourceType: 'consultation_note',
        sourceId: String(consultId),
        title: firstLineTodoTitle(bodyText),
        description: bodyText,
        dueDate: suggestDueDateFromText(bodyText),
        relatedEntityType: 'customer',
        relatedEntityId: String(customerId),
        lockRelated: true,
      })
      setTodoDialogSession((k) => k + 1)
      setTodoDialogOpen(true)
    },
    [customerId],
  )

  return (
    <>
      <div
        className="mobile-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="상담"
        onClick={handleWorkspaceClose}
      >
        <div className="mobile-modal" onClick={(e) => e.stopPropagation()}>
          <div className="mobile-modal-header">
            <span className="mobile-modal-header__spacer" aria-hidden />
            <span className="mobile-modal-header__title">상담</span>
            <CustomerWorkspaceCloseButton onClick={handleWorkspaceClose} />
          </div>
          <div className="mobile-modal-body">
            <div className="mobile-modal-content customer-workspace-mobile-scope">
              <CustomerConsultationsPageMobile
                {...mobileViewProps}
                onAddTodoFromConsultation={openTodoFromConsultation}
              />
            </div>
          </div>
        </div>
      </div>
      <TodoEditorDialog
        open={todoDialogOpen}
        usePortal
        onClose={() => {
          setTodoDialogOpen(false)
          setTodoPrefill(null)
        }}
        token={token ?? ''}
        gaId={gaIdNumeric}
        sessionKey={todoDialogSession}
        prefill={todoPrefill}
        onCommitted={() => {}}
      />
      {confirmDialog}
    </>
  )
}
