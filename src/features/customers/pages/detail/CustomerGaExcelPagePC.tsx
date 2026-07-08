import { useParams } from 'react-router-dom'
import { EmptyState, LoadingState, StatusMessage } from '../../../../components/feedback'
import { FormButton } from '../../../../components/form'
import GaCustomerMatchAliasesCard from '../../components/GaCustomerMatchAliasesCard'
import { useGaCustomerExcelData } from '../../hooks/useGaCustomerExcelData'
import {
  formatGaCellDisplay,
  gaCustomerDataCellClassName,
  gaCustomerDataGridTemplateColumns,
  MSG_GA_EXCEL_NO_DISPLAY_KEYS,
  MSG_GA_EXCEL_NO_MAPPED_DATA,
  MSG_GA_EXCEL_UPLOAD_HINT,
} from '../../utils/gaCustomerDataView'

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
  const { loading, error, info, headers, colIds, sortedRows, sortIdx, sortAsc, onHeaderClick, reload } =
    useGaCustomerExcelData(customerId)

  const emptyMappingMessage = `${MSG_GA_EXCEL_NO_MAPPED_DATA} ${MSG_GA_EXCEL_UPLOAD_HINT}`
  const showTable = !loading && !error && sortedRows.length > 0 && colIds.length > 0
  const showBrokenColumns = !loading && !error && sortedRows.length > 0 && colIds.length === 0
  const gridTemplateColumns = gaCustomerDataGridTemplateColumns(colIds.length)

  return (
    <main className="page customer-ga-excel-page customer-ga-excel-page--pc p-3">
      <div className="customer-ga-excel-page__headline-row customer-ga-excel-page__headline-row--pc">
        <h2 className="customer-ga-excel-page__headline-title text-lg font-semibold text-[var(--text-primary)]">
          GA 고객 데이터
        </h2>
        <div className="customer-ga-excel-page__aliases-slot customer-ga-excel-page__aliases-slot--pc">
          <GaCustomerMatchAliasesCard
            customerId={customerId}
            layout="pc"
            onSaved={() => void reload()}
          />
        </div>
      </div>
      <div className="customer-ga-excel-page__hints text-sm text-[var(--text-secondary)] mb-3 space-y-1">
        <p className="m-0">업로드는 내정보관리 페이지에서 진행합니다.</p>
        <p className="m-0">입력칸은 쉼표(,)로 구분합니다.</p>
      </div>

      <StatusMessage message={error} tone="error" />
      <StatusMessage message={info} tone="default" />

      {loading ? (
        <LoadingState message="불러오는 중…" />
      ) : error ? null : sortedRows.length === 0 ? (
        <EmptyState message={emptyMappingMessage} />
      ) : showBrokenColumns ? (
        <EmptyState message={`${MSG_GA_EXCEL_NO_DISPLAY_KEYS} ${MSG_GA_EXCEL_UPLOAD_HINT}`} />
      ) : showTable ? (
        <div className="ga-customer-data-table-scroll">
          <div
            className="ga-customer-data-table"
            style={{ ['--ga-customer-data-grid-columns' as string]: gridTemplateColumns }}
          >
            <div className="ga-customer-data-header" role="row">
              {headers.map((h, idx) => {
                const colId = colIds[idx] ?? String(idx)
                const cellClass = gaCustomerDataCellClassName(colId, h)
                return (
                  <div key={colId} className={cellClass} role="columnheader">
                    <FormButton
                      htmlType="button"
                      variant="action"
                      className="ga-customer-data-header__button"
                      onClick={() => onHeaderClick(idx)}
                    >
                      {h}
                      {sortIdx === idx ? (sortAsc ? ' ▲' : ' ▼') : ''}
                    </FormButton>
                  </div>
                )
              })}
            </div>
            {sortedRows.map((r) => (
              <div key={r.rowIndex} className="ga-customer-data-row" role="row">
                {colIds.map((cid, idx) => (
                  <div
                    key={cid}
                    className={gaCustomerDataCellClassName(cid, headers[idx] ?? cid)}
                    role="cell"
                  >
                    {formatGaCellDisplay(r.cells[cid])}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </main>
  )
}
