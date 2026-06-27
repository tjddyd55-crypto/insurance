import { formatKstDateDots } from '../../../utils/displayDateTime'
import type { UserInsurerAccountRow } from '../api/userInsurerAccountsApi'

/** 계정관리 테이블 저장일 — YYYY.MM.DD (KST), 미저장 시 '-' */
export function formatAccountSavedAt(row: UserInsurerAccountRow): string {
  if (!row.loginId.trim() && !row.loginPassword.trim()) {
    return '-'
  }
  return formatKstDateDots(row.updatedAt) || '-'
}
