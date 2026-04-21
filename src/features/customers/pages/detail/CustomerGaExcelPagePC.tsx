import { useParams } from 'react-router-dom'
import { EmptyState, LoadingState, StatusMessage } from '../../../../components/feedback'
import { FormButton } from '../../../../components/form'
import { useGaCustomerExcelData } from '../../hooks/useGaCustomerExcelData'

/**
 * [PC 전용 View] GA 고객 데이터 테이블 — PC 브라우저·Electron 화면.
 *
 * 이 파일의 책임: PC UI 마크업과 PC 전용 className 부착만.
 *  - 데이터·상태:  ../../hooks/useGaCustomerExcelData.ts
 *  - 라우팅·가드:  ../CustomerGaExcelPage.tsx (container)
 *  - 모바일 대응:  ./CustomerGaExcelPageMobile.tsx
 *
 * 스타일 조정은 src/index.css 의 `.customer-ga-excel-page--pc` 스코프에서 한다.
 * 이 컴포넌트 안에서 모바일 분기 (`useIsMobile` 등) 를 호출하지 않는다.
 */
export default function CustomerGaExcelPagePC() {
  const { customerId: customerIdParam } = useParams()
  const customerId = Number(customerIdParam)
  const { loading, error, info, headers, colIds, sortedRows, sortIdx, sortAsc, onHeaderClick } =
    useGaCustomerExcelData(customerId)

  return (
    <main className="page customer-ga-excel-page customer-ga-excel-page--pc p-3">
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
    </main>
  )
}
