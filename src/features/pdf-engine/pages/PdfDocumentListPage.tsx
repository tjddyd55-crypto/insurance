/**
 * 사용자용 문서(PDF 템플릿) 목록.
 *
 * 서버가 이미 GA 범위와 `is_active` 를 필터링하므로, 이 페이지는 표시/정렬만 담당한다.
 * 발급/폼은 상세 페이지로 위임하여 "목록은 네비게이션, 상세는 작업" 경계를 유지한다.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../../lib/apiClient'
import { useAuth } from '../../auth/AuthProvider'
import { listPdfTemplates } from '../api/pdfTemplateApi'
import type { PdfTemplateSummary } from '../types'
import '../pdf-engine.css'

export default function PdfDocumentListPage() {
  const { token } = useAuth()
  const [rows, setRows] = useState<PdfTemplateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token?.trim()) return
    let cancelled = false
    setLoading(true)
    setError(null)
    listPdfTemplates(token)
      .then((res) => {
        if (cancelled) return
        const sorted = [...res.templates].sort((a, b) => a.title.localeCompare(b.title, 'ko'))
        setRows(sorted)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof ApiError ? e.message : '문서 목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <main className="pdf-engine-page">
      <h1 className="pdf-engine-page__title">문서</h1>
      <p className="pdf-engine-page__hint">
        원하는 문서를 선택하고, 안내에 따라 값을 입력하면 PDF 로 발급됩니다.
      </p>

      {error ? <div className="pdf-engine-page__error">{error}</div> : null}
      {loading ? <p className="pdf-engine-page__hint">불러오는 중…</p> : null}

      {!loading && rows.length === 0 && !error ? (
        <p className="pdf-engine-page__hint">현재 사용 가능한 문서가 없습니다.</p>
      ) : null}

      <ul className="pdf-engine-doc-list">
        {rows.map((r) => (
          <li key={r.id} className="pdf-engine-doc-list__item">
            <Link to={`/application/documents/${r.id}`} className="pdf-engine-doc-list__link">
              <strong>{r.title}</strong>
              {r.description ? (
                <span className="pdf-engine-editor__field-meta">{r.description}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
