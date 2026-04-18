import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { EmptyState, LoadingState } from '../../../components/feedback'
import useIsMobile from '../../../hooks/useIsMobile'
import { useAuth } from '../../auth/AuthProvider'
import { useGaSettings } from '../../ga-settings/useGaSettings'
import {
  fetchCustomerGaExcelData,
  type GaCustomerExcelDataRow,
} from '../api/gaCustomerExcelApi'
import CustomerGaExcelPageMobile from './detail/CustomerGaExcelPageMobile'
import CustomerGaExcelPagePC from './detail/CustomerGaExcelPagePC'

export default function CustomerGaExcelPage() {
  const { customerId: customerIdParam } = useParams()
  const customerId = Number(customerIdParam)
  const { token } = useAuth()
  const { gaSettings, loading: gaSettingsLoading } = useGaSettings()
  const isMobile = useIsMobile()
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

  if (isMobile) {
    return (
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
    )
  }

  return (
    <CustomerGaExcelPagePC
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
  )
}
