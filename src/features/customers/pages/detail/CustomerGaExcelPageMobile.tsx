import { EmptyState, LoadingState, StatusMessage } from '../../../../components/feedback'
import { FormButton } from '../../../../components/form'
import type { GaCustomerExcelDataRow } from '../../api/gaCustomerExcelApi'

type CustomerGaExcelPageMobileProps = {
  loading: boolean
  error: string
  info: string
  headers: string[]
  colIds: string[]
  sortedRows: GaCustomerExcelDataRow[]
  sortIdx: number | null
  sortAsc: boolean
  onHeaderClick: (idx: number) => void
}

export default function CustomerGaExcelPageMobile({
  loading,
  error,
  info,
  headers,
  colIds,
  sortedRows,
  sortIdx,
  sortAsc,
  onHeaderClick,
}: CustomerGaExcelPageMobileProps) {
  return (
    <div className="p-3" style={{ maxWidth: 960 }}>
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">GA 고객 데이터</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-3">
        업로드는 내정보관리 페이지에서 진행합니다. 여기서는 고객 매핑 결과만 확인할 수 있습니다.
      </p>
      <StatusMessage message={error} tone="error" />
      <StatusMessage message={info} tone="default" />

      {loading ? (
        <LoadingState message="불러오는 중…" />
      ) : headers.length === 0 ? (
        <EmptyState message="표시할 열이 설정되어 있지 않습니다." />
      ) : (
        <div className="ga-table-scroll overflow-x-auto border border-[var(--border-default)] rounded-md">
          <table className="admin-data-table" style={{ minWidth: 400 }}>
            <thead>
              <tr>
                {headers.map((h, idx) => (
                  <th key={colIds[idx] ?? String(idx)}>
                    <FormButton
                      htmlType="button"
                      variant="action"
                      className="text-left underline-offset-2 hover:underline text-sm font-semibold !justify-start"
                      onClick={() => onHeaderClick(idx)}
                    >
                      {h}
                      {sortIdx === idx ? (sortAsc ? ' ▲' : ' ▼') : ''}
                    </FormButton>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
                <tr key={r.rowIndex}>
                  {colIds.map((cid) => (
                    <td key={cid}>{r.cells[cid] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
