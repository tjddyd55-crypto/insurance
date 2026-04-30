/**
 * 발급 이력 페이지(사용자/관리자 공용).
 *
 * - 사용자는 본인 이력만, 관리자는 전체 이력을 본다 — 서버에서 분기하므로 프론트는 표만 그린다.
 * - 각 행에서 "다운로드" 를 누르면 서버에 보관된 PDF 를 그대로 받아준다.
 *   재스탬프가 아닌 "원본 보관본" 다운로드라, 폰트/엔진 변경 후에도 당시 그대로 검증 가능.
 *
 * 이 페이지는 I/O 만 담당한다. 포맷팅이 늘어나면 분리한다.
 */

import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../../lib/apiClient'
import FormButton from '../../../components/form/FormButton'
import { useAuth } from '../../auth/AuthProvider'
import {
  fetchPdfIssuanceFile,
  listPdfIssuances,
  type PdfIssuanceSummary,
} from '../api/pdfTemplateApi'
import '../pdf-engine.css'

/** Blob → 브라우저 다운로드 트리거. URL 누수 방지를 위해 즉시 revoke. */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '-'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(raw: string): string {
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return raw
    return d.toLocaleString('ko-KR', { hour12: false })
  } catch {
    return raw
  }
}

export default function PdfIssuanceHistoryPage() {
  const { token } = useAuth()
  const [rows, setRows] = useState<PdfIssuanceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  useEffect(() => {
    if (!token?.trim()) return
    let cancelled = false
    setLoading(true)
    setError(null)
    listPdfIssuances(token)
      .then((res) => {
        if (cancelled) return
        setRows(res.issuances)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof ApiError ? e.message : '발급 이력을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const handleDownload = useCallback(
    async (row: PdfIssuanceSummary) => {
      if (!token?.trim()) return
      setDownloadingId(row.id)
      try {
        const blob = await fetchPdfIssuanceFile(token, row.id)
        triggerDownload(blob, `${row.templateCode}-${row.id}.pdf`)
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '다운로드에 실패했습니다.')
      } finally {
        setDownloadingId(null)
      }
    },
    [token],
  )

  return (
    <main className="insurance-dark-forms pdf-engine-page">
      <h1 className="pdf-engine-page__title">발급 이력</h1>
      <p className="pdf-engine-page__hint">
        과거에 발급한 문서를 다시 다운로드할 수 있습니다. 목록은 최근순으로 최대 200건까지 표시됩니다.
      </p>

      {error ? <div className="pdf-engine-page__error">{error}</div> : null}
      {loading ? <p className="pdf-engine-page__hint">불러오는 중…</p> : null}

      {!loading && rows.length === 0 && !error ? (
        <p className="pdf-engine-page__hint">아직 발급한 문서가 없습니다.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="pdf-engine-issuance-list">
          <div className="pdf-engine-issuance-list__head">
            <span>문서</span>
            <span>발급 일시</span>
            <span>용량</span>
            <span />
          </div>
          {rows.map((row) => (
            <div key={row.id} className="pdf-engine-issuance-list__row">
              <span>
                <strong>{row.templateTitle}</strong>
                <span className="pdf-engine-editor__field-meta"> #{row.id}</span>
              </span>
              <span>{formatDate(row.createdAt)}</span>
              <span>{formatBytes(row.byteLength)}</span>
              <span>
                <FormButton
                  variant="secondary"
                  size="sm"
                  disabled={downloadingId === row.id}
                  onClick={() => handleDownload(row)}
                >
                  {downloadingId === row.id ? '받는 중…' : '다운로드'}
                </FormButton>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </main>
  )
}
