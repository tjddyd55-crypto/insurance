import type { ButtonHTMLAttributes, ReactNode } from 'react'

/** 고객 작업영역 모바일 — 액션 버튼 CSS scope (outlet·modal·페이지 shell 공통) */
export const CUSTOMER_WORKSPACE_MOBILE_SCOPE_CLASS = 'customer-workspace-mobile-scope'

/** 메모·상담 workspace 모바일 액션 버튼 — className SSOT */
export const CUSTOMER_WORKSPACE_ACTION_PRIMARY_CLASS =
  'customer-workspace-action-button customer-workspace-action-button--primary'
export const CUSTOMER_WORKSPACE_ACTION_SECONDARY_CLASS =
  'customer-workspace-action-button customer-workspace-action-button--secondary'
export const CUSTOMER_WORKSPACE_ACTION_DANGER_CLASS =
  'customer-workspace-action-button customer-workspace-action-button--danger'
export const CUSTOMER_WORKSPACE_ACTION_ICON_CLASS = 'customer-workspace-action-icon-button'
export const CUSTOMER_WORKSPACE_ITEM_ACTIONS_CLASS = 'customer-workspace-item-actions'
export const CUSTOMER_WORKSPACE_ITEM_ACTIONS_STACKED_CLASS =
  'customer-workspace-item-actions customer-workspace-item-actions--stacked'

type WorkspaceActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  children: ReactNode
  disabled?: boolean
}

function mergeWorkspaceActionClass(baseClass: string, className?: string): string {
  return [baseClass, className].filter(Boolean).join(' ')
}

type WorkspaceIconActionButtonProps = WorkspaceActionButtonProps & {
  ariaLabel: string
}

type WorkspaceItemActionsProps = {
  children: ReactNode
  /** memo: 본문 우측 inline / consultation: 본문 아래 stacked */
  layout?: 'inline' | 'stacked'
}

/** outlet·modal·페이지 shell에 scope 클래스 부여 */
export function CustomerWorkspaceMobileScope({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const merged = [CUSTOMER_WORKSPACE_MOBILE_SCOPE_CLASS, className].filter(Boolean).join(' ')
  return <div className={merged}>{children}</div>
}

/** [메모]/[상담] 섹션 헤더 우측 — 메모 추가·상담 추가 */
export function CustomerWorkspacePrimaryActionButton({
  children,
  disabled,
  className,
  ...props
}: WorkspaceActionButtonProps) {
  return (
    <button
      type="button"
      className={mergeWorkspaceActionClass(CUSTOMER_WORKSPACE_ACTION_PRIMARY_CLASS, className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

/** 할 일로 추가·수정 등 secondary 액션 */
export function CustomerWorkspaceSecondaryActionButton({
  children,
  disabled,
  className,
  ...props
}: WorkspaceActionButtonProps) {
  return (
    <button
      type="button"
      className={mergeWorkspaceActionClass(CUSTOMER_WORKSPACE_ACTION_SECONDARY_CLASS, className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

/** 텍스트 삭제 액션 (상담 "삭제") */
export function CustomerWorkspaceDangerActionButton({
  children,
  disabled,
  className,
  ...props
}: WorkspaceActionButtonProps) {
  return (
    <button
      type="button"
      className={mergeWorkspaceActionClass(CUSTOMER_WORKSPACE_ACTION_DANGER_CLASS, className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

/** 메모 X 삭제 아이콘 버튼 */
export function CustomerWorkspaceIconDeleteButton({
  ariaLabel,
  children = '×',
  disabled,
  className,
  ...props
}: WorkspaceIconActionButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      className={mergeWorkspaceActionClass(CUSTOMER_WORKSPACE_ACTION_ICON_CLASS, className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

/** 섹션 헤더 우측 버튼 묶음 — 메모 화면과 동일 wrapper */
export function CustomerWorkspaceSectionHeadActions({ children }: { children: ReactNode }) {
  return <div className="customer-workspace-section-head-actions">{children}</div>
}

/** 섹션 헤더 — [메모]/[상담] + 우측 액션 */
export function CustomerWorkspaceSectionHead({
  title,
  actions,
}: {
  title: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="customer-workspace-section-head">
      <div className="customer-section-title !mt-0">{title}</div>
      {actions}
    </div>
  )
}

/** 항목 하단/우측 액션 버튼 묶음 */
export function CustomerWorkspaceItemActions({
  children,
  layout = 'inline',
}: WorkspaceItemActionsProps) {
  const className =
    layout === 'stacked'
      ? CUSTOMER_WORKSPACE_ITEM_ACTIONS_STACKED_CLASS
      : CUSTOMER_WORKSPACE_ITEM_ACTIONS_CLASS
  return <div className={className}>{children}</div>
}
