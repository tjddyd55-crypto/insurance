import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBlocker } from 'react-router'
import * as XLSX from 'xlsx'
import { FormButton, FormInput } from '../../../components/form'
import { StatusMessage } from '../../../components/feedback'
import { ExitConfirmDialog } from '../../../components/ExitConfirmDialog'
import {
  fetchGaCustomerExcelCapability,
  fetchUserExcelData,
  patchUserExcelColumns,
  uploadUserExcelData,
  type GaCustomerExcelCapability,
} from '../../customers/api/gaCustomerExcelApi'

const L = {
  label: 'GA 데이터 업로드',
  loadFail: '불러오지 못했습니다.',
  pickFile: '파일을 선택해 주세요.',
  uploadFail: '업로드에 실패했습니다.',
  parseFail: '엑셀 파일을 읽을 수 없습니다.',
  saveFail: '저장에 실패했습니다.',
  noFeature: '이 GA에서는 이 기능을 사용할 수 없습니다.',
  intro:
    'GA에 설정된 샘플과 동일한 열 구조의 파일만 업로드할 수 있습니다. 업로드 시 기존 데이터는 삭제 후 대치됩니다.',
  fileTypes: '파일 (.xlsx / .xls)',
  save: '저장',
  reset: '초기화',
  displayTitle: '컬럼 노출 설정',
  allColumnsTitle: '전체 컬럼',
  previewTitle: '엑셀 데이터 미리보기',
  previewGuide: '업로드된 데이터의 상위 10행을 표시합니다.',
  previewEmpty: '업로드된 데이터가 없습니다.',
  emptyCols: '샘플 엑셀 설정 후 여기에 컬럼 목록이 표시됩니다.',
  unsavedNotice: '아직 저장되지 않은 데이터입니다. 저장 버튼을 눌러야 실제 고객 데이터에 반영됩니다.',
  leaveConfirm:
    '아직 저장되지 않은 업로드 데이터가 있습니다. 이동하면 업로드한 내용이 사라집니다. 이동하시겠습니까?',
}

type Props = {
  token: string
}

type SaveResult = {
  rowCount: number
  savedAt: string
}

export function UserGaExcelManagePanel({ token }: Props) {
  const [cap, setCap] = useState<GaCustomerExcelCapability | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [rowCount, setRowCount] = useState<number | null>(null)
  const [sampleColumns, setSampleColumns] = useState<{ id: string; header: string }[]>([])
  const [rows, setRows] = useState<{ rowIndex: number; cells: Record<string, string> }[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [draftRowCount, setDraftRowCount] = useState<number | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [localPreview, setLocalPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const [visibility, setVisibility] = useState<Record<string, boolean>>({})
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null)

  const hasUnsavedDraft = selectedFile != null

  const load = useCallback(async () => {
    if (!token?.trim()) {
      return
    }
    setLoadErr('')
    try {
      const c = await fetchGaCustomerExcelCapability(token)
      setCap(c)
      if (!c.showDesignerUi) {
        setRowCount(null)
        setSampleColumns([])
        setRows([])
        setVisibility({})
        return
      }
      const d = await fetchUserExcelData(token)
      setRowCount(d.sourceRowCount)
      setSampleColumns(d.sampleColumns.map((x) => ({ id: x.id, header: x.header })))
      setRows(d.rows)
      const vis: Record<string, boolean> = {}
      for (const col of d.sampleColumns) {
        vis[col.id] = true
      }
      for (const s of d.columnSettings) {
        vis[s.column_name] = s.is_visible
      }
      setVisibility(vis)
    } catch (e) {
      setCap(null)
      setLoadErr(e instanceof Error ? e.message : L.loadFail)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!hasUnsavedDraft) {
      return
    }
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedDraft])

  const navigationBlocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) => {
        if (!hasUnsavedDraft) {
          return false
        }
        return (
          currentLocation.pathname !== nextLocation.pathname ||
          currentLocation.search !== nextLocation.search ||
          currentLocation.hash !== nextLocation.hash
        )
      },
      [hasUnsavedDraft],
    ),
  )

  const savedSummary = useMemo(() => {
    if (!cap?.showDesignerUi || rowCount == null) {
      return ''
    }
    return `저장된 데이터: ${rowCount}건`
  }, [cap?.showDesignerUi, rowCount])

  const previewRows = useMemo(() => rows.slice(0, 10), [rows])

  const serverPreview = useMemo(() => {
    const headers = sampleColumns.map((c) => c.header)
    const tableRows = previewRows.map((r) => sampleColumns.map((c) => String(r.cells[c.id] ?? '')))
    return { headers, rows: tableRows }
  }, [previewRows, sampleColumns])

  const previewTable = useMemo(() => {
    if (localPreview?.headers?.length) {
      return localPreview
    }
    return serverPreview
  }, [localPreview, serverPreview])

  const previewColumns = useMemo(() => {
    const headers = previewTable.headers.length > 0 ? previewTable.headers : sampleColumns.map((c) => c.header)
    return headers.map((header, idx) => {
      const mappedColumn = sampleColumns[idx] ?? null
      return {
        key: mappedColumn?.id ?? `col-${idx}`,
        header,
        sampleId: mappedColumn?.id ?? null,
        checked: mappedColumn ? visibility[mappedColumn.id] !== false : false,
      }
    })
  }, [previewTable.headers, sampleColumns, visibility])

  const clearDraft = useCallback(() => {
    setSelectedFile(null)
    setDraftRowCount(null)
    setLocalPreview(null)
    setFileInputKey((prev) => prev + 1)
    setLoadErr('')
    setInfo('')
  }, [])

  const parseLocalPreview = useCallback(async (file: File) => {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array', cellDates: true })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) {
      throw new Error('EMPTY_WORKBOOK')
    }
    const sheet = wb.Sheets[sheetName]
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: '' })
    const headerRow = Array.isArray(matrix[0]) ? matrix[0] : []
    const headers = headerRow.map((v) => String(v ?? '').trim())
    const dataRows = matrix
      .slice(1, 11)
      .map((row) =>
        Array.from({ length: headers.length }, (_, i) => {
          const cell = Array.isArray(row) ? row[i] : ''
          return String(cell ?? '')
        }),
      )
    const totalDataRows = Math.max(0, matrix.length - 1)
    setDraftRowCount(totalDataRows)
    setLocalPreview({ headers, rows: dataRows })
    setSaveResult(null)
  }, [])

  const onSave = async () => {
    if (!token?.trim() || !cap?.showDesignerUi) {
      return
    }
    const file = selectedFile
    if (!file?.size) {
      setInfo('')
      setLoadErr(L.pickFile)
      return
    }
    setBusy(true)
    setLoadErr('')
    setInfo('')
    try {
      const r = await uploadUserExcelData(token, file)
      setSaveResult({ rowCount: r.rowCount, savedAt: new Date().toISOString() })
      setInfo(`저장 완료: 총 ${r.rowCount}건 처리`)
      await load()
      clearDraft()
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : L.saveFail)
    } finally {
      setBusy(false)
    }
  }

  const onToggleColumn = async (colId: string, next: boolean) => {
    if (!token?.trim() || !cap?.showDesignerUi) {
      return
    }
    setVisibility((prev) => ({ ...prev, [colId]: next }))
    setLoadErr('')
    try {
      await patchUserExcelColumns(token, [{ column_name: colId, is_visible: next }])
    } catch (e) {
      setVisibility((prev) => ({ ...prev, [colId]: !next }))
      setLoadErr(e instanceof Error ? e.message : L.saveFail)
    }
  }

  if (loadErr && !cap) {
    return (
      <div className="field">
        <span className="field__label">{L.label}</span>
        <StatusMessage message={loadErr} tone="error" />
      </div>
    )
  }

  if (!cap?.featureEnabled) {
    return null
  }

  if (!cap.showDesignerUi) {
    return (
      <div className="field">
        <span className="field__label">{L.label}</span>
        <p className="text-sm text-[var(--text-secondary)]">{cap.message || L.noFeature}</p>
      </div>
    )
  }

  return (
    <div className="field ga-data-upload-panel">
      <span className="field__label">{L.label}</span>
      <p className="text-sm text-[var(--text-secondary)] mb-2">{L.intro}</p>
      {savedSummary && !hasUnsavedDraft ? (
        <p className="text-sm text-[var(--text-primary)] mb-2">{savedSummary}</p>
      ) : null}
      <StatusMessage message={loadErr} tone="error" />
      <StatusMessage message={info} tone="default" />

      <div className="flex flex-wrap items-end gap-2 mb-4">
        <label className="text-sm text-[var(--text-secondary)]">
          {L.fileTypes}
          <FormInput
            key={`ga-user-excel-file-${fileInputKey}`}
            type="file"
            name="gaUserExcel"
            accept=".xlsx,.xls"
            className="block mt-1 text-sm"
            onChange={(ev) => {
              const file = ev.target.files?.[0] ?? null
              setSelectedFile(file)
              setLoadErr('')
              setInfo('')
              if (!file) {
                setLocalPreview(null)
                setDraftRowCount(null)
                return
              }
              void parseLocalPreview(file).catch(() => {
                setLocalPreview(null)
                setDraftRowCount(null)
                setLoadErr(L.parseFail)
              })
            }}
          />
        </label>
      </div>

      {sampleColumns.length > 0 ? (
        <div className="ga-data-upload-section">
          <div className="ga-data-upload-preview-card mt-4">
            <span className="field__label block mb-1">{L.previewTitle}</span>
            <p className="text-sm text-[var(--text-secondary)] mb-1">{L.previewGuide}</p>
            <p className="text-sm text-[var(--text-secondary)] mb-2">
              {L.displayTitle}: {L.allColumnsTitle} 체크를 각 컬럼 헤더 위에서 바로 설정할 수 있습니다.
            </p>

            <div className="ga-data-upload-action-bar mb-3">
              {hasUnsavedDraft ? (
                <p className="text-sm text-[var(--text-primary)] mb-2">
                  {L.unsavedNotice}
                  {draftRowCount != null ? ` (선택 파일 ${draftRowCount}행)` : null}
                </p>
              ) : null}
              {saveResult && !hasUnsavedDraft ? (
                <div className="text-sm text-[var(--text-primary)] mb-2">
                  <p>저장 완료: 총 {saveResult.rowCount}건 처리</p>
                  <p>총 {saveResult.rowCount}건 처리 완료</p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <FormButton htmlType="button" variant="primary" disabled={busy || !hasUnsavedDraft} onClick={() => void onSave()}>
                  {L.save}
                </FormButton>
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  disabled={busy || !hasUnsavedDraft}
                  onClick={clearDraft}
                >
                  {L.reset}
                </FormButton>
              </div>
            </div>

            {previewColumns.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">{L.previewEmpty}</p>
            ) : (
              <div className="ga-data-upload-preview-shell">
                <div className="ga-data-upload-preview-scroll">
                  <table className="ga-data-upload-preview-table admin-data-table">
                    <thead>
                      <tr className="profile-page__excel-preview-toggle-row">
                        {previewColumns.map((col) => {
                          const sampleId = col.sampleId
                          return (
                            <th key={`preview-toggle-${col.key}`} className="profile-page__excel-preview-toggle-cell">
                              {sampleId ? (
                                <FormInput
                                  type="checkbox"
                                  id={`ga-col-preview-${sampleId}`}
                                  checked={col.checked}
                                  onChange={(ev) => void onToggleColumn(sampleId, ev.target.checked)}
                                  className="shrink-0"
                                />
                              ) : (
                                <span className="text-[var(--text-secondary)]">-</span>
                              )}
                            </th>
                          )
                        })}
                      </tr>
                      <tr>
                        {previewColumns.map((col) => (
                          <th key={`preview-head-${col.key}`}>
                            {col.sampleId ? (
                              <label htmlFor={`ga-col-preview-${col.sampleId}`} className="profile-page__excel-preview-head-label">
                                {col.header}
                              </label>
                            ) : (
                              col.header
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewTable.rows.map((r, rowIdx) => (
                        <tr key={`preview-row-${rowIdx}`}>
                          {previewColumns.map((_, colIdx) => (
                            <td key={`preview-cell-${rowIdx}-${colIdx}`}>{r[colIdx] ?? ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">{L.emptyCols}</p>
      )}

      {navigationBlocker.state === 'blocked' ? (
        <ExitConfirmDialog
          title="페이지 이동 확인"
          message={L.leaveConfirm}
          onCancel={() => navigationBlocker.reset()}
          onConfirm={() => {
            clearDraft()
            navigationBlocker.proceed()
          }}
        />
      ) : null}
    </div>
  )
}
