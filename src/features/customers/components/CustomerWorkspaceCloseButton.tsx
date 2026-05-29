import { FormButton } from '../../../components/form'

type CustomerWorkspaceCloseButtonProps = {
  onClick: () => void
  disabled?: boolean
  /** outlet 모달 헤더 등 레거시 hook class (예: workspace-mobile-outlet-modal__close) */
  className?: string
}

/**
 * 고객 작업영역 모바일 패널 닫기 — 고객 수정 화면 "취소" 버튼과 동일한 secondary pill.
 * 텍스트만 "닫기", onClick 은 호출부 onClose 그대로.
 */
export default function CustomerWorkspaceCloseButton({
  onClick,
  disabled = false,
  className = '',
}: CustomerWorkspaceCloseButtonProps) {
  const mergedClassName = [
    'customer-detail-action-button',
    'customer-workspace-close-button',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <FormButton
      htmlType="button"
      variant="secondary"
      size="sm"
      className={mergedClassName}
      aria-label="닫기"
      disabled={disabled}
      onClick={onClick}
    >
      닫기
    </FormButton>
  )
}
