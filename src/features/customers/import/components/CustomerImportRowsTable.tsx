import { labelForImportStatus } from '../utils/customerImportLabels'
import type { CustomerImportRowRecord } from '../types/customerImportTypes'

function displaySsn(n: CustomerImportRowRecord['normalizedRow']): string {
  if (!n) {
    return ''
  }
  const raw = n.ssnDigits || n.ssn || ''
  return raw ? String(raw) : ''
}

type Props = {
  rows: CustomerImportRowRecord[]
  loading?: boolean
}

export function CustomerImportRowsTable({ rows, loading }: Props) {
  if (loading) {
    return <p className="text-sm text-[var(--text-secondary)]">불러오는 중…</p>
  }
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--text-secondary)]">표시할 행이 없습니다.</p>
  }
  return (
    <div className="overflow-x-auto border border-[var(--border-default)] rounded-md">
      <table className="min-w-full text-sm">
        <thead className="bg-[var(--bg-soft)] text-[var(--text-secondary)]">
          <tr>
            {[
              '행',
              '이름',
              '전화',
              '주민/생년',
              '성별',
              '주소',
              '차량번호',
              '만기일',
              '상태',
              '사유',
            ].map((h) => (
              <th key={h} className="text-left font-medium px-2 py-2 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-[var(--text-primary)]">
          {rows.map((r) => {
            const n = r.normalizedRow
            return (
              <tr key={r.id} className="border-t border-[var(--border-default)]">
                <td className="px-2 py-2 whitespace-nowrap">{r.rowIndex}</td>
                <td className="px-2 py-2 whitespace-nowrap">{n?.name ?? ''}</td>
                <td className="px-2 py-2 whitespace-nowrap">{n?.phone ?? ''}</td>
                <td className="px-2 py-2 whitespace-nowrap">{displaySsn(n)}</td>
                <td className="px-2 py-2 whitespace-nowrap">{n?.gender ?? ''}</td>
                <td className="px-2 py-2 max-w-[200px] truncate" title={n?.address}>
                  {n?.address ?? ''}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">{n?.carNumber ?? ''}</td>
                <td className="px-2 py-2 whitespace-nowrap">{n?.renewalDate ?? ''}</td>
                <td className="px-2 py-2 whitespace-nowrap">{labelForImportStatus(r.status)}</td>
                <td className="px-2 py-2 max-w-[220px] truncate" title={r.reason ?? ''}>
                  {r.reason ?? ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
