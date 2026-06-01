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
  /** 기본 true. 입력·작성·수정 모달은 false 로 바깥 클릭 시 닫힘을 막는다(데이터 유실 방지). */
  closeOnBackdrop?: boolean
  /** 기본 true. `onEscapeRequest` 가 있으면 Escape 는 항상 그쪽으로만 간다. */
  closeOnEsc?: boolean
  /** Escape 시 `onClose` 대신 호출(미저장 확인 등). */
  onEscapeRequest?: () => void
  /** `largeForm` 는 넓은 폼 모달용(기본 w/max-w/p 제거). */
  panelPreset?: 'default' | 'largeForm'
  /** true 이면 document.body 에 portal 렌더(중첩 outlet 모달 안 confirm 등). */
  usePortal?: boolean
}

export default function Modal({
  open,
  onClose,
  children,
  ariaLabel = '대화상자',
  panelClassName = '',
  initialFocusRef,
  closeOnBackdrop = true,
  closeOnEsc = true,
  onEscapeRequest,
  panelPreset = 'default',
  usePortal = false,
}: ModalProps) {
  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      ariaLabel={ariaLabel}
      panelClassName={panelClassName}
      initialFocusRef={initialFocusRef}
      closeOnBackdrop={closeOnBackdrop}
      closeOnEsc={closeOnEsc}
      onEscapeRequest={onEscapeRequest}
      panelPreset={panelPreset}
      usePortal={usePortal}
    >
      {children}
    </BaseDialog>
  )
}
