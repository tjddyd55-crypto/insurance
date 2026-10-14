import { useEffect, useMemo, useState } from 'react'
import { BaseDialog } from '../../../../components/dialog/BaseDialog'
import { FormButton, FormSelect } from '../../../../components/form'
import { getPersonalBinder, listPersonalBinders } from '../../../personal-binder/personalBinder.api'
import type { PersonalBinder, PersonalBinderSummary } from '../../../personal-binder/personalBinder.types'
import {
  importNewslettersToBinder,
  type NewsletterBinderImportResponse,
} from '../../services/newsletterCollections.service'
import { summarizeNewsletterImport } from './newsletterImportSummary'

/** [내 바인더에 담기] — 바인더 → 섹션(필수) → 확인. A4 PDF로 변환해 기존 바인더 자료 경로로 담는다. */
export function NewsletterAddToBinderDialog({
  open,
  token,
  newsletterIds,
  onClose,
  onDone,
}: {
  open: boolean
  token: string | null | undefined
  newsletterIds: string[]
  onClose: () => void
  onDone: (message: string, response: NewsletterBinderImportResponse) => void
}) {
  const [binders, setBinders] = useState<PersonalBinderSummary[]>([])
  const [binderId, setBinderId] = useState('')
  const [binder, setBinder] = useState<PersonalBinder | null>(null)
  const [sectionId, setSectionId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setBinderId('')
    setBinder(null)
    setSectionId('')
    setError('')
    setBusy(false)
    let cancelled = false
    void (async () => {
      try {
        const rows = await listPersonalBinders(token ?? null)
        if (!cancelled) setBinders(rows)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '바인더 목록을 불러오지 못했습니다.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, token])

  useEffect(() => {
    if (!open || !binderId) {
      setBinder(null)
      return
    }
    let cancelled = false
    setSectionId('')
    void (async () => {
      try {
        const row = await getPersonalBinder(token ?? null, binderId)
        if (!cancelled) setBinder(row)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '바인더를 불러오지 못했습니다.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, binderId, token])

  const sectionOptions = useMemo(
    () => [
      { value: '', label: binder?.sections.length ? '섹션 선택 (필수)' : '섹션이 없습니다' },
      ...(binder?.sections ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => ({ value: s.id, label: s.title })),
    ],
    [binder],
  )

  const submit = async () => {
    if (busy) return
    if (!sectionId) {
      setError('담을 섹션을 선택해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await importNewslettersToBinder(token, sectionId, newsletterIds)
      const sectionTitle = binder?.sections.find((s) => s.id === sectionId)?.title ?? ''
      const message = summarizeNewsletterImport(response, `${binder?.title ?? ''} › ${sectionTitle}`)
      if (response.succeeded === 0) {
        setError(message)
        return
      }
      onDone(message, response)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '바인더에 담지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BaseDialog open={open} onClose={onClose} closeOnBackdrop={false} usePortal ariaLabel="내 바인더에 담기">
      <div className="newsletter-collections-dialog">
        <h2 className="newsletter-collections-dialog__title">내 바인더에 담기</h2>
        <p className="newsletter-collections-dialog__hint">
          소식지를 A4 PDF로 변환해 선택한 섹션에 담습니다. 바인더에는 별도 사본이 저장됩니다.
        </p>
        <FormSelect
          value={binderId}
          onChange={(e) => setBinderId(e.target.value)}
          options={[
            { value: '', label: binders.length ? '바인더 선택' : '바인더가 없습니다' },
            ...binders.map((b) => ({ value: b.id, label: b.title })),
          ]}
          aria-label="바인더"
        />
        <FormSelect
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          options={sectionOptions}
          disabled={!binder}
          aria-label="섹션"
        />
        {error ? <p className="newsletter-collections-dialog__error" role="alert">{error}</p> : null}
        <div className="newsletter-collections-dialog__actions">
          <FormButton variant="secondary" size="sm" onClick={onClose}>취소</FormButton>
          <FormButton
            variant="primary"
            size="sm"
            loading={busy}
            loadingText="PDF 변환 중…"
            disabled={!sectionId}
            onClick={() => void submit()}
          >
            담기
          </FormButton>
        </div>
      </div>
    </BaseDialog>
  )
}
