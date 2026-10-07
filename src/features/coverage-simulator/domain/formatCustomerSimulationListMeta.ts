import { formatConsultationListDate } from './formatConsultationDate'

type RowDates = {
  createdAt?: string | null
  updatedAt?: string | null
}

/** 고객 탭 등 compact list: 같은 날짜면 수정일만 1회 표시 */
export function formatCustomerSimulationListMetaLines(row: RowDates): string[] {
  const created = formatConsultationListDate(row.createdAt)
  const updated = formatConsultationListDate(row.updatedAt)
  if (created === updated) {
    return updated === '—' ? [] : [`수정 ${updated}`]
  }
  const lines: string[] = []
  if (created !== '—') lines.push(`작성 ${created}`)
  if (updated !== '—') lines.push(`수정 ${updated}`)
  return lines
}
