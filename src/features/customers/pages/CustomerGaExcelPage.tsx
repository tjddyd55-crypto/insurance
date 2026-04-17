import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { EmptyState, LoadingState, StatusMessage } from '../../../components/feedback'
import { FormButton } from '../../../components/form'
import { useMediaQuery } from '../../../hooks/useMediaQuery'
import { useAuth } from '../../auth/AuthProvider'
import { useGaSettings } from '../../ga-settings/useGaSettings'
import {
  fetchCustomerGaExcelData,
  type GaCustomerExcelDataRow,
} from '../api/gaCustomerExcelApi'

export default function CustomerGaExcelPage() {
  const { customerId: customerIdParam } = useParams()
  const customerId = Number(customerIdParam)
  const { token } = useAuth()
  const { gaSettings, loading: gaSettingsLoading } = useGaSettings()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [colIds, setColIds] = useState<string[]>([])
  const [rows, setRows] = useState<GaCustomerExcelDataRow[]>([])
  const [sortIdx, setSortIdx] = useState<number | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

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
  }, [token, customerId])

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
  }, [rows, colIds, sortIdx, sortAsc])

  const onHeaderClick = (idx: number) => {
    if (sortIdx === idx) {
      setSortAsc((v) => !v)
    } else {
      setSortIdx(idx)
      setSortAsc(true)
    }
  }

  if (!Number.isFinite(customerId) || customerId < 1) {
    return <EmptyState message="고객을 선택해 주세요." />
  }
  if (gaSettingsLoading) {
    return <LoadingState message="권한 확인 중…" />
  }
  if (!gaSettings.use_ga_excel) {
    return <Navigate to={`/customers?customerId=${customerId}`} replace />
  }

  return (
    <div className="p-3" style={isMobile ? { maxWidth: 960 } : { maxWidth: 'none', width: '100%' }}>
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
        <div className="overflow-x-auto border border-[var(--border-default)] rounded-md">
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
