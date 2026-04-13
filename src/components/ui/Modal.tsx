import type { ReactNode } from 'react'
import { BaseDialog } from '../dialog/BaseDialog'

export type ModalProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** 접근성용 — 기본 "대화상자" */
  ariaLabel?: string
  /** 패널에 추가할 클래스(폭 등). 예: max-w-2xl */
  panelClassName?: string
  /** 모달 열릴 때 우선 포커스 대상 */
  initialFocusRef?: React.RefObject<HTMLElement | null>
}

export default function Modal({
  open,
  onClose,
  children,
  ariaLabel = '대화상자',
  panelClassName = '',
  initialFocusRef,
}: ModalProps) {
  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      ariaLabel={ariaLabel}
      panelClassName={panelClassName}
      initialFocusRef={initialFocusRef}
      closeOnBackdrop
      closeOnEsc
    >
      {children}
    </BaseDialog>
  )
}
