import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ApiError,
  fetchContractPublicDocumentDetail,
  resolveContractPdfPreviewAbsUrl,
  type ContractDocumentDetailPayload,
} from './contractPublicClient'

export default function ContractSignDocumentPage() {
  const { linkCode: linkCodeParam, documentInstanceId: docIdParam } = useParams<{
    linkCode: string
    documentInstanceId: string
  }>()
  const linkCode = String(linkCodeParam ?? '').trim()
  const documentInstanceId = String(docIdParam ?? '').trim()
  const paramsInvalid = !linkCode || !documentInstanceId

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<ContractDocumentDetailPayload | null>(null)

  useEffect(() => {
    if (paramsInvalid) {
      return
    }
    let cancelled = false

    void (async () => {
      await Promise.resolve()
      if (cancelled) {
        return
      }
      setLoading(true)
      setError('')
      try {
        const d = await fetchContractPublicDocumentDetail(linkCode, documentInstanceId)
        if (!cancelled) {
          setDetail(d)
        }
      } catch (e) {
        if (cancelled) {
          return
        }
        setDetail(null)
        if (e instanceof ApiError && e.status === 403) {
          setError('계약서 수신번호 인증이 필요합니다. 목록 화면에서 인증을 완료해 주세요.')
          return
        }
        if (e instanceof ApiError && e.status === 404) {
          setError('문서를 찾을 수 없습니다.')
          return
        }
        setError(e instanceof ApiError ? e.message : '문서를 불러오지 못했습니다.')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [linkCode, documentInstanceId, paramsInvalid])

  let body: ReactNode
  if (paramsInvalid) {
    body = (
      <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
        <p className="text-sm">링크가 올바르지 않습니다.</p>
        <Link
          className="text-sm font-medium text-slate-900 underline"
          to={linkCode ? `/contracts/sign/${encodeURIComponent(linkCode)}` : '/'}
        >
          목록으로
        </Link>
      </div>
    )
  } else if (loading) {
    body = <p className="text-slate-600">불러오는 중…</p>
  } else if (error || !detail) {
    body = (
      <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
        <p className="text-sm">{error || '문서를 표시할 수 없습니다.'}</p>
        <Link className="text-sm font-medium text-slate-900 underline" to={`/contracts/sign/${encodeURIComponent(linkCode)}`}>
          목록으로
        </Link>
      </div>
    )
  } else {
    const pdfSrc = resolveContractPdfPreviewAbsUrl(linkCode, documentInstanceId)
    body = (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-lg font-semibold text-slate-900">{detail.document.title || '문서'}</p>
          <p className="mt-1 text-sm text-slate-600">
            {detail.document.required ? '필수 문서' : '선택 문서'} · 상태: {detail.document.status}
          </p>
          {detail.pdfTemplate ? (
            <p className="mt-2 text-xs text-slate-500">
              템플릿: {detail.pdfTemplate.title} ({detail.pdfTemplate.pageCount}페이지)
            </p>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100" style={{ minHeight: '360px' }}>
          <iframe title="PDF 미리보기" src={pdfSrc} className="h-[70vh] w-full border-0 bg-white" />
        </div>

        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
          {detail.notice ?? '서명·작성 저장은 다음 단계에서 연결됩니다.'}
        </div>

        {detail.fields.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
            <p className="font-medium text-slate-800">입력 필드 {detail.fields.length}개 (좌표 연동은 다음 단계)</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {detail.fields.slice(0, 12).map((f) => (
                <li key={f.id}>
                  {f.label || f.fieldKey} ({f.fieldType}
                  {f.required ? ', 필수' : ''})
                </li>
              ))}
            </ul>
            {detail.fields.length > 12 ? <p className="mt-1">… 외 {detail.fields.length - 12}개</p> : null}
          </div>
        ) : null}

        <Link
          className="inline-block text-sm font-medium text-slate-900 underline"
          to={`/contracts/sign/${encodeURIComponent(linkCode)}`}
        >
          ← 문서 목록
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <h1 className="mb-6 text-center text-xl font-bold text-slate-900">계약서 문서</h1>
        {body}
      </div>
    </div>
  )
}
