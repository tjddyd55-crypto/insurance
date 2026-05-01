import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SignatureModal } from '../../consent/components/SignatureModal'
import { FormButton, FormInput, FormSelect, FormTextarea } from '../../../components/form'
import '../../consent/consent.css'
import {
  ApiError,
  fetchContractPublicDocumentDetail,
  formatContractPublicActionError,
  postContractPublicDocumentComplete,
  postContractPublicDocumentSign,
  postContractPublicDocumentValues,
  resolveContractPdfPreviewAbsUrl,
  type ContractDocumentDetailPayload,
  type ContractPublicValueInput,
} from './contractPublicClient'

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('read'))
    r.readAsDataURL(blob)
  })
}

function buildDraftsFromDetail(d: ContractDocumentDetailPayload): Record<string, string | boolean> {
  const next: Record<string, string | boolean> = {}
  for (const f of d.fields) {
    if (f.fieldType === 'signature') {
      continue
    }
    if (f.fieldType === 'checkbox') {
      next[f.id] = f.publicValue?.kind === 'checkbox' ? f.publicValue.checked : false
      continue
    }
    if (f.fieldType === 'radio') {
      const v = f.publicValue?.kind === 'radio' ? f.publicValue.value : ''
      next[f.id] = v || (typeof f.suggestedDefault === 'string' ? f.suggestedDefault : '')
      continue
    }
    const pv = f.publicValue?.kind === 'text' ? f.publicValue.value : ''
    const fallback = typeof f.suggestedDefault === 'string' ? f.suggestedDefault : ''
    next[f.id] = pv || fallback
  }
  return next
}

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
  const [drafts, setDrafts] = useState<Record<string, string | boolean>>({})
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const [signAck, setSignAck] = useState(false)
  const [completeAck, setCompleteAck] = useState(false)
  const [signatureDrafts, setSignatureDrafts] = useState<Record<string, string>>({})
  const [sigModalField, setSigModalField] = useState<{ id: string; label: string } | null>(null)
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null)
  const [pdfLoadState, setPdfLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  const reloadDetail = useCallback(
    async (isCancelled?: () => boolean) => {
      const d = await fetchContractPublicDocumentDetail(linkCode, documentInstanceId)
      if (isCancelled?.()) {
        return
      }
      setDetail(d)
      await Promise.resolve()
      if (isCancelled?.()) {
        return
      }
      setDrafts(buildDraftsFromDetail(d))
    },
    [linkCode, documentInstanceId],
  )

  useEffect(() => {
    setSignatureDrafts({})
  }, [linkCode, documentInstanceId])

  useEffect(() => {
    if (paramsInvalid || !detail) {
      return
    }
    const url = resolveContractPdfPreviewAbsUrl(linkCode, documentInstanceId)
    let cancelled = false
    let objectUrl: string | null = null

    setPdfLoadState('loading')
    setPdfObjectUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev)
      }
      return null
    })

    void (async () => {
      try {
        const res = await fetch(url, { credentials: 'include' })
        if (import.meta.env.DEV) {
          console.info('[contract pdf preview]', {
            documentInstanceId,
            pdfTemplateId: detail.document.pdfTemplateId,
            previewUrl: url,
            status: res.status,
            contentType: res.headers.get('content-type'),
          })
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const ct = res.headers.get('content-type') ?? ''
        if (!ct.includes('application/pdf')) {
          throw new Error(`unexpected content-type: ${ct}`)
        }
        const blob = await res.blob()
        if (cancelled) {
          return
        }
        const nextUrl = URL.createObjectURL(blob)
        objectUrl = nextUrl
        setPdfObjectUrl(nextUrl)
        setPdfLoadState('ready')
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error('[contract pdf preview]', e)
        }
        if (!cancelled) {
          setPdfLoadState('error')
        }
      }
    })()

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [detail, linkCode, documentInstanceId, paramsInvalid])

  useEffect(() => {
    if (paramsInvalid) {
      return
    }
    let cancelled = false
    const isCancelled = () => cancelled

    void (async () => {
      await Promise.resolve()
      if (cancelled) {
        return
      }
      setLoading(true)
      setError('')
      try {
        await reloadDetail(isCancelled)
        if (!cancelled) {
          setActionError('')
          setSignAck(false)
          setCompleteAck(false)
        }
      } catch (e) {
        if (cancelled) {
          return
        }
        setDetail(null)
        setDrafts({})
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
  }, [linkCode, documentInstanceId, paramsInvalid, reloadDetail])

  const onSaveValues = async () => {
    if (!detail || detail.canEdit === false) {
      return
    }
    setActionError('')
    setSaving(true)
    try {
      const values: ContractPublicValueInput[] = []
      for (const f of detail.fields) {
        if (f.fieldType === 'signature') {
          continue
        }
        const raw = drafts[f.id]
        if (f.fieldType === 'checkbox') {
          values.push({ fieldId: f.id, fieldKey: f.fieldKey, value: Boolean(raw) })
          continue
        }
        values.push({ fieldId: f.id, fieldKey: f.fieldKey, value: raw == null ? '' : String(raw) })
      }
      await postContractPublicDocumentValues(linkCode, documentInstanceId, values)
      await reloadDetail()
    } catch (e) {
      setActionError(formatContractPublicActionError(e))
    } finally {
      setSaving(false)
    }
  }

  const onSignField = async (fieldId: string) => {
    if (!detail || detail.canEdit === false) {
      return
    }
    if (!signAck) {
      setActionError('전자서명 진술에 동의해 주세요.')
      return
    }
    const dataUrl = signatureDrafts[fieldId]?.trim()
    if (!dataUrl) {
      setActionError('전자서명 입력하기에서 서명을 작성한 뒤 적용해 주세요.')
      return
    }
    setActionError('')
    setSaving(true)
    try {
      await postContractPublicDocumentSign(linkCode, documentInstanceId, {
        signatureImageData: dataUrl,
        fieldId,
        electronicSignAcknowledged: true,
      })
      setSignatureDrafts((prev) => {
        const next = { ...prev }
        delete next[fieldId]
        return next
      })
      setSignAck(false)
      await reloadDetail()
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error('[contract public sign]', e)
      }
      setActionError(formatContractPublicActionError(e))
    } finally {
      setSaving(false)
    }
  }

  const onComplete = async () => {
    if (!detail || detail.canEdit === false) {
      return
    }
    if (!completeAck) {
      setActionError('문서 완료를 위해 확인 문구에 동의해 주세요.')
      return
    }
    setActionError('')
    setSaving(true)
    try {
      await postContractPublicDocumentComplete(linkCode, documentInstanceId, {
        acknowledgeElectronicContract: true,
      })
      await reloadDetail()
      setCompleteAck(false)
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        setActionError(e.message || '필수 항목이 남았습니다.')
      } else if (e instanceof ApiError && e.status === 409) {
        const pack = e.data as { evidence?: { evidenceHashPrefix?: string | null } | null } | undefined
        const prefix = pack?.evidence?.evidenceHashPrefix
        setActionError(
          prefix ? `${e.message} (증빙 해시 일부: ${prefix})` : e.message,
        )
      } else {
        setActionError(formatContractPublicActionError(e))
      }
    } finally {
      setSaving(false)
    }
  }

  const pdfSrc = !paramsInvalid ? resolveContractPdfPreviewAbsUrl(linkCode, documentInstanceId) : ''

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
    const canEdit = detail.canEdit !== false && detail.document.status !== 'completed'
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

        {detail.document.status === 'completed' && detail.evidenceSummary ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
            <p className="text-sm font-semibold">전자서명이 완료되었습니다.</p>
            <p className="mt-2 text-sm">인증 방식: {detail.evidenceSummary.authenticationLabel}</p>
            {detail.evidenceSummary.completedAt ? (
              <p className="mt-1 text-sm">완료 시각: {detail.evidenceSummary.completedAt}</p>
            ) : null}
            {!detail.evidenceSummary.completedAt && detail.evidenceSummary.signedAt ? (
              <p className="mt-1 text-sm">서명 시각: {detail.evidenceSummary.signedAt}</p>
            ) : null}
            {detail.evidenceSummary.evidenceHashPrefix ? (
              <p className="mt-2 text-xs text-emerald-900">
                서명 증빙 기록(해시 일부): {detail.evidenceSummary.evidenceHashPrefix}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100" style={{ minHeight: '360px' }}>
          {pdfLoadState === 'loading' ? (
            <div className="flex h-[50vh] min-h-[280px] items-center justify-center text-sm text-slate-600">계약서 PDF 불러오는 중…</div>
          ) : null}
          {pdfLoadState === 'error' ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 px-4 py-8 text-center">
              <p className="text-sm text-slate-700">문서 미리보기를 불러오지 못했습니다.</p>
              <a
                href={pdfSrc}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-blue-600 underline"
              >
                PDF 새 창에서 열기
              </a>
            </div>
          ) : null}
          {pdfLoadState === 'ready' && pdfObjectUrl ? (
            <iframe title="PDF 미리보기" src={pdfObjectUrl} className="h-[70vh] min-h-[320px] w-full border-0 bg-white" />
          ) : null}
          {pdfLoadState === 'idle' ? (
            <div className="flex h-[50vh] min-h-[280px] items-center justify-center text-sm text-slate-500">미리보기 준비 중…</div>
          ) : null}
        </div>

        <p className="text-sm text-slate-700">{detail.notice}</p>

        {actionError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{actionError}</div>
        ) : null}

        {detail.fields.length > 0 ? (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-800">문서 입력</p>
            {detail.fields.map((f) => {
              if (f.fieldType === 'signature') {
                const signed = f.publicValue?.kind === 'signature' ? f.publicValue.signed : false
                const draftUrl = signatureDrafts[f.id]
                return (
                  <div key={f.id} className="space-y-2 border-t border-slate-100 pt-3">
                    <p className="text-sm text-slate-800">
                      {f.label || f.fieldKey}
                      {f.required ? <span className="text-rose-600"> *</span> : null}
                      {signed ? <span className="ml-2 text-emerald-600">(전자서명 완료)</span> : null}
                    </p>
                    {!canEdit || signed ? null : (
                      <>
                        <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                          <FormInput
                            type="checkbox"
                            checked={signAck}
                            onChange={(ev) => setSignAck(ev.target.checked)}
                            className="mt-0.5"
                          />
                          <span>본인은 본 계약서가 본인에게 발송된 문서임을 확인하고, 전자서명합니다.</span>
                        </label>
                        {draftUrl ? (
                          <>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                              <img src={draftUrl} alt="서명 미리보기" className="mx-auto max-h-32 object-contain" />
                            </div>
                            <p className="text-xs text-emerald-700">서명이 입력되었습니다. 아래 버튼으로 저장할 수 있습니다.</p>
                            <FormButton
                              htmlType="button"
                              variant="secondary"
                              fullWidth
                              disabled={saving}
                              onClick={() => {
                                setSigModalField({ id: f.id, label: f.label || f.fieldKey })
                              }}
                            >
                              다시 서명하기
                            </FormButton>
                          </>
                        ) : (
                          <FormButton
                            htmlType="button"
                            variant="secondary"
                            fullWidth
                            disabled={saving}
                            onClick={() => {
                              setSigModalField({ id: f.id, label: f.label || f.fieldKey })
                            }}
                          >
                            전자서명 입력하기
                          </FormButton>
                        )}
                        <FormButton
                          htmlType="button"
                          variant="primary"
                          fullWidth
                          loading={saving}
                          onClick={() => void onSignField(f.id)}
                        >
                          전자서명 완료
                        </FormButton>
                      </>
                    )}
                  </div>
                )
              }
              if (f.fieldType === 'checkbox') {
                const checked = Boolean(drafts[f.id])
                return (
                  <label key={f.id} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                    <FormInput
                      type="checkbox"
                      disabled={!canEdit}
                      checked={checked}
                      onChange={(ev) => setDrafts((prev) => ({ ...prev, [f.id]: ev.target.checked }))}
                      className="mt-0.5"
                    />
                    <span>
                      {f.label || f.fieldKey}
                      {f.required ? <span className="text-rose-600"> *</span> : null}
                    </span>
                  </label>
                )
              }
              if (f.fieldType === 'radio') {
                const opts = Array.isArray(f.options) ? f.options.map((x) => String(x)) : []
                const cur = String(drafts[f.id] ?? '')
                return (
                  <div key={f.id} className="space-y-1">
                    <p className="text-sm text-slate-800">
                      {f.label || f.fieldKey}
                      {f.required ? <span className="text-rose-600"> *</span> : null}
                    </p>
                    <FormSelect
                      disabled={!canEdit}
                      value={cur}
                      options={[{ value: '', label: '선택' }, ...opts.map((o) => ({ value: o, label: o }))]}
                      onChange={(ev) => setDrafts((prev) => ({ ...prev, [f.id]: ev.target.value }))}
                      className="w-full"
                    />
                  </div>
                )
              }
              const isTextarea = f.fieldType === 'textarea'
              const tv = String(drafts[f.id] ?? '')
              return (
                <div key={f.id} className="space-y-1">
                  <p className="text-sm text-slate-800">
                    {f.label || f.fieldKey}
                    {f.required ? <span className="text-rose-600"> *</span> : null}
                  </p>
                  {isTextarea ? (
                    <FormTextarea
                      disabled={!canEdit}
                      value={tv}
                      onChange={(ev) => setDrafts((prev) => ({ ...prev, [f.id]: ev.target.value }))}
                      rows={4}
                      className="w-full text-sm"
                    />
                  ) : (
                    <FormInput
                      type="text"
                      disabled={!canEdit}
                      value={tv}
                      onChange={(ev) => setDrafts((prev) => ({ ...prev, [f.id]: ev.target.value }))}
                      className="w-full text-sm"
                    />
                  )}
                </div>
              )
            })}

            {canEdit ? (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  fullWidth
                  loading={saving}
                  onClick={() => void onSaveValues()}
                >
                  임시저장
                </FormButton>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                  <FormInput
                    type="checkbox"
                    checked={completeAck}
                    onChange={(ev) => setCompleteAck(ev.target.checked)}
                    className="mt-0.5"
                  />
                  <span>필수 항목을 확인했으며, 이 문서를 완료합니다.</span>
                </label>
                <FormButton htmlType="button" variant="primary" fullWidth loading={saving} onClick={() => void onComplete()}>
                  문서 완료
                </FormButton>
              </div>
            ) : null}
          </div>
        ) : null}

        <Link className="inline-block text-sm font-medium text-slate-900 underline" to={`/contracts/sign/${encodeURIComponent(linkCode)}`}>
          ← 문서 목록
        </Link>

        <SignatureModal
          open={sigModalField != null}
          title="전자서명 입력"
          description="손가락 또는 마우스로 서명하세요."
          saveLabel="서명 적용"
          onClose={() => setSigModalField(null)}
          onSave={async (blob) => {
            if (!sigModalField) {
              return
            }
            const dataUrl = await blobToDataUrl(blob)
            const fid = sigModalField.id
            setSignatureDrafts((prev) => ({ ...prev, [fid]: dataUrl }))
          }}
        />
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
