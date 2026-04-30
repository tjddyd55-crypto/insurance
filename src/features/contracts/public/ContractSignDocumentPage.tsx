import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SignaturePad, type SignaturePadHandle } from '../../consent/components/SignaturePad'
import { FormButton, FormInput, FormSelect, FormTextarea } from '../../../components/form'
import {
  ApiError,
  fetchContractPublicDocumentDetail,
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
  const sigRefs = useRef<Map<string, SignaturePadHandle | null>>(new Map())

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
      setActionError(e instanceof ApiError ? e.message : '저장에 실패했습니다.')
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
    const h = sigRefs.current.get(fieldId)
    if (!h || h.isEmpty()) {
      setActionError('서명을 입력해 주세요.')
      return
    }
    setActionError('')
    setSaving(true)
    try {
      const blob = await h.exportPng()
      const signatureImageData = await blobToDataUrl(blob)
      await postContractPublicDocumentSign(linkCode, documentInstanceId, {
        signatureImageData,
        fieldId,
        electronicSignAcknowledged: true,
      })
      h.clear()
      setSignAck(false)
      await reloadDetail()
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : '서명 저장에 실패했습니다.')
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
      } else {
        setActionError(e instanceof ApiError ? e.message : '문서 완료 처리에 실패했습니다.')
      }
    } finally {
      setSaving(false)
    }
  }

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

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100" style={{ minHeight: '360px' }}>
          <iframe title="PDF 미리보기" src={pdfSrc} className="h-[70vh] w-full border-0 bg-white" />
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
                        <div
                          className="rounded-lg border border-slate-200 bg-white p-2"
                          style={
                            {
                              '--consent-signature-bg': 'var(--bg-main)',
                              '--consent-signature-ink': 'var(--text-main)',
                            } as CSSProperties
                          }
                        >
                          <SignaturePad
                            className="h-40 w-full"
                            ref={(inst) => {
                              const m = sigRefs.current
                              if (inst) {
                                m.set(f.id, inst)
                              } else {
                                m.delete(f.id)
                              }
                            }}
                          />
                        </div>
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
