import type { ReactNode } from 'react'
import Modal from '../../../components/ui/Modal'
import { CustomerWorkspaceMobileScope } from './CustomerWorkspaceActionButtons'

/** 메모/상담/고객파일 workspace form 모달 panel SSOT */
export const CUSTOMER_WORKSPACE_FORM_MODAL_PANEL_CLASS = 'max-w-lg w-[92vw] customer-workspace-form-modal'

type CustomerWorkspaceFormModalShellProps = {
  open: boolean
  onClose: () => void
  ariaLabel: string
  children: ReactNode
  closeOnBackdrop?: boolean
  onEscapeRequest?: () => void
  /** outlet 중첩 form 모달(고객 파일 삭제/이름변경) — body portal */
  usePortal?: boolean
  /** panelClassName 에 추가할 modifier (예: file-folder-create-modal) */
  panelClassExtra?: string
}

/**
 * 고객 작업영역 모바일 form 모달 shell SSOT.
 * DOM: customer-ui-modal-panel.customer-workspace-form-modal > customer-workspace-mobile-scope > … > footer
 */
export function CustomerWorkspaceFormModalShell({
  open,
  onClose,
  ariaLabel,
  children,
  closeOnBackdrop = false,
  onEscapeRequest,
  usePortal = false,
  panelClassExtra,
}: CustomerWorkspaceFormModalShellProps) {
  const panelClassName = [CUSTOMER_WORKSPACE_FORM_MODAL_PANEL_CLASS, panelClassExtra].filter(Boolean).join(' ')

  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel={ariaLabel}
      panelClassName={panelClassName}
      closeOnBackdrop={closeOnBackdrop}
      onEscapeRequest={onEscapeRequest}
      usePortal={usePortal}
    >
      <CustomerWorkspaceMobileScope>{children}</CustomerWorkspaceMobileScope>
    </Modal>
  )
}
