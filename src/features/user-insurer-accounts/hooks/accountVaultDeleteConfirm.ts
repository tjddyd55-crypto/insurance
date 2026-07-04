import type { ConfirmDialogProps } from '../../../components/dialog/ConfirmDialog'
import type { AccountVaultAdapter } from '../api/accountVaultAdapter'
import type { UserInsurerAccountRow } from '../api/userInsurerAccountsApi'
import { USER_INSURER_ACCOUNT_TABS } from '../config/userInsurerAccounts.config'

type ConfirmRequest = Pick<
  ConfirmDialogProps,
  'title' | 'message' | 'confirmLabel' | 'cancelLabel' | 'tone'
>

export function buildAccountDeleteConfirmRequest(row: UserInsurerAccountRow): ConfirmRequest {
  const categoryLabel =
    USER_INSURER_ACCOUNT_TABS.find((tab) => tab.value === row.category)?.label ?? '계정'
  const companyName = row.companyName.trim() || '계정'

  return {
    title: '계정을 삭제할까요?',
    message: `${categoryLabel} 계정 ‘${companyName}’을(를) 삭제할까요?\n삭제한 계정 정보는 복구할 수 없습니다.`,
    confirmLabel: '삭제',
    cancelLabel: '취소',
    tone: 'danger',
  }
}

export async function deleteAccountWithConfirm(
  row: UserInsurerAccountRow,
  adapter: AccountVaultAdapter,
  confirm: (request: ConfirmRequest) => Promise<boolean>,
  options?: { onConfirmed?: () => void },
): Promise<boolean> {
  if (!row.isCustom) {
    return false
  }

  const confirmed = await confirm(buildAccountDeleteConfirmRequest(row))
  if (!confirmed) {
    return false
  }

  options?.onConfirmed?.()
  await adapter.deleteAccount(row.id)
  return true
}
