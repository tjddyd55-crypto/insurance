import { formatCustomerSsnUi } from '../../customers/utils/customerDisplayFormat'

/**
 * 보험사별 데스크톱 고객명 옆 주민번호.
 * 고객 상세 읽기(`formatCustomerSsnUi`)와 같은 하이픈 형식.
 * 값이 없으면 고객 상세와 같은 '—'. 전화번호로 대체하지 않는다.
 */
export function formatInsurerCustomerResidentBesideName(raw: string | null | undefined): string {
  const formatted = formatCustomerSsnUi(raw)
  return formatted || '—'
}
