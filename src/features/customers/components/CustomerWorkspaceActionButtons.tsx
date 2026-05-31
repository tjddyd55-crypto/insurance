import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { FormButton } from '../../../components/form'

/** 메모·상담 workspace 모바일 액션 버튼 — className SSOT */
export const CUSTOMER_WORKSPACE_ACTION_PRIMARY_CLASS =
  'customer-workspace-action-button customer-workspace-action-button--primary'
export const CUSTOMER_WORKSPACE_ACTION_SECONDARY_CLASS =
  'customer-workspace-action-button customer-workspace-action-button--secondary'
export const CUSTOMER_WORKSPACE_ACTION_DANGER_CLASS =
  'customer-workspace-action-button customer-workspace-action-button--danger'
export const CUSTOMER_WORKSPACE_ACTION_ICON_CLASS = 'customer-workspace-action-icon-button'
export const CUSTOMER_WORKSPACE_ITEM_ACTIONS_CLASS = 'customer-workspace-item-actions'

type WorkspaceActionButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'className'
> & {
  children: ReactNode
  disabled?: boolean
}

type WorkspaceIconActionButtonProps = WorkspaceActionButtonProps & {
  ariaLabel: string
}

/** [메모]/[상담] 섹션 헤더 우측 — 메모 추가·상담 추가 */
export function CustomerWorkspacePrimaryActionButton({
  children,
  disabled,
  ...props
}: WorkspaceActionButtonProps) {
  return (
    <FormButton
      htmlType="button"
      variant="action"
      className={CUSTOMER_WORKSPACE_ACTION_PRIMARY_CLASS}
      disabled={disabled}
      {...props}
    >
      {children}
    </FormButton>
  )
}

/** 할 일로 추가·수정 등 secondary 액션 */
export function CustomerWorkspaceSecondaryActionButton({
  children,
  disabled,
  ...props
}: WorkspaceActionButtonProps) {
  return (
    <FormButton
      htmlType="button"
      variant="action"
      className={CUSTOMER_WORKSPACE_ACTION_SECONDARY_CLASS}
      disabled={disabled}
      {...props}
    >
      {children}
    </FormButton>
  )
}

/** 텍스트 삭제 액션 (상담 "삭제") */
export function CustomerWorkspaceDangerActionButton({
  children,
  disabled,
  ...props
}: WorkspaceActionButtonProps) {
  return (
    <FormButton
      htmlType="button"
      variant="action"
      className={CUSTOMER_WORKSPACE_ACTION_DANGER_CLASS}
      disabled={disabled}
      {...props}
    >
      {children}
    </FormButton>
  )
}

/** 메모 X 삭제 아이콘 버튼 */
export function CustomerWorkspaceIconDeleteButton({
  ariaLabel,
  children = '×',
  disabled,
  ...props
}: WorkspaceIconActionButtonProps) {
  return (
    <FormButton
      htmlType="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      variant="action"
      className={CUSTOMER_WORKSPACE_ACTION_ICON_CLASS}
      disabled={disabled}
      {...props}
    >
      {children}
    </FormButton>
  )
}

/** 섹션 헤더 우측 버튼 묶음 — 메모 화면과 동일 wrapper */
export function CustomerWorkspaceSectionHeadActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2 shrink-0">{children}</div>
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
    <div className="flex justify-between items-center mb-2 gap-2">
      <div className="customer-section-title !mt-0">{title}</div>
      {actions}
    </div>
  )
}

/** 항목 하단/우측 액션 버튼 묶음 */
export function CustomerWorkspaceItemActions({ children }: { children: ReactNode }) {
  return <div className={CUSTOMER_WORKSPACE_ITEM_ACTIONS_CLASS}>{children}</div>
}
