import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState, LoadingState } from '../../../../components/feedback'
import { FormButton } from '../../../../components/form'
import { useAuth } from '../../../auth/AuthProvider'
import { useGaSettings } from '../../../ga-settings/useGaSettings'
import {
  fetchCustomerGaExcelData,
  type GaCustomerExcelDataRow,
} from '../../api/gaCustomerExcelApi'
import CustomerGaExcelPageMobile from '../../pages/detail/CustomerGaExcelPageMobile'

type CustomerGaDataModalProps = {
  customerId: number
  onClose: () => void
}

export default function CustomerGaDataModal({ customerId, onClose }: CustomerGaDataModalProps) {
  const { token } = useAuth()
  const { gaSettings, loading: gaSettingsLoading } = useGaSettings()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [colIds, setColIds] = useState<string[]>([])
  const [rows, setRows] = useState<GaCustomerExcelDataRow[]>([])
  const [sortIdx, setSortIdx] = useState<number | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  const load = useCallback(async () => {
    if (!token?.trim() || !Number.isFinite(customerId) || customerId < 1) {
      setLoading(false)
      return
    }
    setError('')
    setInfo('')
    setLoading(true)
    try {
      const data = await fetchCustomerGaExcelData(token, customerId)
      setHeaders(data.displayHeaders)
      setColIds(data.displayColumnIds)
      setRows(data.rows)
      if (data.message) {
        setInfo(data.message)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터를 불러오지 못했습니다.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [customerId, token])

  useEffect(() => {
    if (!token?.trim() || !Number.isFinite(customerId) || customerId < 1) {
      return
    }
    setHeaders([])
    setColIds([])
    setRows([])
    setSortIdx(null)
    setSortAsc(true)
  }, [customerId, token])

  useEffect(() => {
    void load()
  }, [load])

  const sortedRows = useMemo(() => {
    if (sortIdx == null || sortIdx < 0 || sortIdx >= colIds.length) {
      return rows
    }
    const key = colIds[sortIdx]
    const copy = [...rows]
    copy.sort((a, b) => {
      const va = String(a.cells[key] ?? '')
      const vb = String(b.cells[key] ?? '')
      const c = va.localeCompare(vb, 'ko')
      return sortAsc ? c : -c
    })
    return copy
  }, [colIds, rows, sortAsc, sortIdx])

  const onHeaderClick = (idx: number) => {
    if (sortIdx === idx) {
      setSortAsc((v) => !v)
      return
    }
    setSortIdx(idx)
    setSortAsc(true)
  }

  return (
    <div className="mobile-modal-overlay" role="dialog" aria-modal="true" aria-label="GA 데이터" onClick={onClose}>
      <style>{`
        .mobile-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 9999;
        }
        .mobile-modal {
          position: fixed;
          inset: 0;
          background: var(--app-bg, #0b0f14);
          color: var(--app-text, #fff);
          display: flex;
          flex-direction: column;
          padding-bottom: env(safe-area-inset-bottom);
          animation: slideUp 0.25s ease;
        }
        .mobile-modal-header {
          height: 56px;
          position: sticky;
          top: 0;
          z-index: 10;
          background: var(--app-bg, #0b0f14);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .mobile-modal-body {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        .mobile-modal-content {
          background: var(--app-bg, #0b0f14);
          color: var(--app-text, #fff);
          min-height: 100%;
        }
        .mobile-modal button {
          min-height: 44px;
        }
        @keyframes slideUp {
          from {
            transform: translateY(20%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
      <div className="mobile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-modal-header">
          <FormButton htmlType="button" variant="action" className="mobile-btn" onClick={onClose}>
            닫기
          </FormButton>
          <span>GA 데이터</span>
        </div>
        <div className="mobile-modal-body">
          <div className="mobile-modal-content">
            {gaSettingsLoading ? (
              <LoadingState message="권한 확인 중…" />
            ) : !gaSettings.use_ga_excel ? (
              <EmptyState message="GA 데이터 보기 권한이 비활성화되어 있습니다." />
            ) : (
              <CustomerGaExcelPageMobile
                loading={loading}
                error={error}
                info={info}
                headers={headers}
                colIds={colIds}
                sortedRows={sortedRows}
                sortIdx={sortIdx}
                sortAsc={sortAsc}
                onHeaderClick={onHeaderClick}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
