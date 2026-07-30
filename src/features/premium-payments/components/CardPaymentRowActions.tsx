import { FormButton } from '../../../components/form'
import {
  CustomerWorkspaceDangerActionButton,
  CustomerWorkspaceItemActions,
  CustomerWorkspaceSecondaryActionButton,
} from '../../customers/components/CustomerWorkspaceActionButtons'

type Props = {
  onEdit: () => void
  onDelete: () => void
  disabled?: boolean
  /** customer workspace 안에서는 workspace 버튼, 큰 메뉴에서는 FormButton */
  variant?: 'workspace' | 'form'
  layout?: 'inline' | 'stacked'
}

/** 카드 수납 수정·삭제 액션 SSOT */
export function CardPaymentRowActions({
  onEdit,
  onDelete,
  disabled = false,
  variant = 'workspace',
  layout = 'inline',
}: Props) {
  if (variant === 'form') {
    return (
      <div className="premium-payments-inline-actions">
        <FormButton htmlType="button" variant="secondary" size="sm" disabled={disabled} onClick={onEdit}>
          수정
        </FormButton>
        <FormButton htmlType="button" variant="danger" size="sm" disabled={disabled} onClick={onDelete}>
          삭제
        </FormButton>
      </div>
    )
  }

  return (
    <CustomerWorkspaceItemActions layout={layout}>
      <CustomerWorkspaceSecondaryActionButton disabled={disabled} onClick={onEdit}>
        수정
      </CustomerWorkspaceSecondaryActionButton>
      <CustomerWorkspaceDangerActionButton disabled={disabled} onClick={onDelete}>
        삭제
      </CustomerWorkspaceDangerActionButton>
    </CustomerWorkspaceItemActions>
  )
}
