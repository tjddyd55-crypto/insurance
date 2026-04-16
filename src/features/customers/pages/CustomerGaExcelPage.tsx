import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { EmptyState, LoadingState, StatusMessage } from '../../../components/feedback'
import { FormButton, FormInput } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import {
  fetchCustomerGaExcelData,
  uploadGaCustomerExcelData,
  type GaCustomerExcelDataRow,
} from '../api/gaCustomerExcelApi'

export default function CustomerGaExcelPage() {
  const { id } = useParams()
  const customerId = Number(id)
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [colIds, setColIds] = useState<string[]>([])
  const [rows, setRows] = useState<GaCustomerExcelDataRow[]>([])
  const [uploadBusy, setUploadBusy] = useState(false)
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

  const onUpload = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    if (!token?.trim()) {
      return
    }
    const fd = new FormData(ev.currentTarget)
    const file = fd.get('datafile') as File | null
    if (!file?.size) {
      setError('파일을 선택해 주세요.')
      return
    }
    setUploadBusy(true)
    setError('')
    try {
      await uploadGaCustomerExcelData(token, file)
      setInfo('업로드가 완료되었습니다. 아래 목록을 갱신합니다.')
      await load()
      ev.currentTarget.reset()
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드에 실패했습니다.')
    } finally {
      setUploadBusy(false)
    }
  }

  if (!Number.isFinite(customerId) || customerId < 1) {
    return <EmptyState message="고객을 선택해 주세요." />
  }

  return (
    <div className="p-3" style={{ maxWidth: 960 }}>
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">GA 고객 데이터</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-3">
        슈퍼 관리자가 이 GA에 대해 저장한 엑셀 설정과 동일한 열 구조의 운영 파일을 업로드한 뒤, 아래에서 고객 정보와 AND 조건으로 일치하는 행만 확인할 수 있습니다.
      </p>
      <StatusMessage message={error} tone="error" />
      <StatusMessage message={info} tone="default" />

      <form onSubmit={(ev) => void onUpload(ev)} className="flex flex-wrap items-end gap-2 mb-4 mt-2">
        <label className="text-sm text-[var(--text-secondary)]">
          운영 엑셀 업로드
          <FormInput type="file" name="datafile" accept=".xlsx,.xls" className="block mt-1 text-sm" />
        </label>
        <FormButton htmlType="submit" variant="secondary" disabled={uploadBusy}>
          업로드
        </FormButton>
      </form>

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
