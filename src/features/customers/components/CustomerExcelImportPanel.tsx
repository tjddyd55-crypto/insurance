import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import type { CustomerUploadBatchResult } from '../utils/customerExcelUpload'
import {
  downloadCustomerUploadSampleXlsx,
  parseExcelToPayloads,
  uploadCustomers,
} from '../utils/customerExcelUpload'

export type CustomerExcelImportPanelProps = {
  token: string
  onUploadsFinished: () => void | Promise<void>
}

export function CustomerExcelImportPanel({ token, onUploadsFinished }: CustomerExcelImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [parsePhase, setParsePhase] = useState(false)
  const [result, setResult] = useState<CustomerUploadBatchResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function resetStatus() {
    setResult(null)
    setError(null)
  }

  return (
    <div className="customers-excel-import-panel" aria-label="고객 엑셀 업로드">
      <button
        type="button"
        className="link-btn link-btn--compact"
        onClick={() => {
          downloadCustomerUploadSampleXlsx()
        }}
      >
        샘플 다운로드
      </button>

      <div className="customers-excel-import-panel__row">
        <input
          ref={fileInputRef}
          type="file"
          className="customers-excel-import-panel__file-input"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            setFile(f)
            resetStatus()
          }}
        />
        <button
          type="button"
          className="link-btn link-btn--compact"
          onClick={() => fileInputRef.current?.click()}
        >
          파일 선택
        </button>
        {file ? <span className="customers-excel-import-panel__fname">{file.name}</span> : null}
        <button
          type="button"
          className="filter-button customers-excel-import-panel__upload-btn"
          disabled={!file || busy}
          onClick={() => {
            void (async () => {
              if (!file || !token) {
                return
              }
              setBusy(true)
              resetStatus()
              setProgress(null)
              setParsePhase(true)
              try {
                const payloads = await parseExcelToPayloads(file)
                setParsePhase(false)
                if (payloads.length === 0) {
                  setError('업로드할 유효한 행이 없습니다. 이름·주민번호를 확인해 주세요.')
                  setBusy(false)
                  return
                }
                const batch = await uploadCustomers(token, payloads, (done, total) => {
                  setProgress({ done, total })
                })
                setResult(batch)
                if (batch.success > 0) {
                  await onUploadsFinished()
                }
              } catch (e) {
                setParsePhase(false)
                setError(e instanceof Error ? e.message : '처리에 실패했습니다.')
              } finally {
                setBusy(false)
                setProgress(null)
              }
            })()
          }}
        >
          엑셀 업로드
        </button>
      </div>

      {busy && parsePhase ? <p className="customers-excel-import-panel__status">파일 분석 중…</p> : null}
      {busy && !parsePhase && progress ? (
        <p className="customers-excel-import-panel__status">
          업로드 중… {progress.done}/{progress.total}
        </p>
      ) : null}

      {result ? (
        <div className="customers-excel-import-panel__result" role="status">
          <p className="customers-excel-import-panel__summary">
            총 {result.total}건 · 성공 {result.success}건 · 실패 {result.failed}건
          </p>
          {result.failures.length > 0 ? (
            <ul className="customers-excel-import-panel__failures">
              {result.failures.slice(0, 30).map((f, idx) => (
                <li key={`${f.ssn}-${idx}`}>
                  {f.name} ({f.ssn}): {f.message}
                </li>
              ))}
              {result.failures.length > 30 ? (
                <li className="customers-excel-import-panel__failures-more">… 외 {result.failures.length - 30}건</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="customers-excel-import-panel__error" role="alert">
          {error}
        </p>
      ) : null}

      <Link to="/account/reset" className="link-btn link-btn--compact customers-excel-import-panel__reset">
        계정 초기화
      </Link>
    </div>
  )
}
