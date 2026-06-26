import { formatKstDateTimeDisplay } from '../../../utils/displayDateTime'
import type { UserInsurerAccountRow } from '../api/userInsurerAccountsApi'

/** 계정관리 테이블 저장일 — 아직 저장된 자격증명이 없으면 '-' */
export function formatAccountSavedAt(row: UserInsurerAccountRow): string {
  if (!row.loginId.trim() && !row.loginPassword.trim()) {
    return '-'
  }
  return formatKstDateTimeDisplay(row.updatedAt, '-')
}
