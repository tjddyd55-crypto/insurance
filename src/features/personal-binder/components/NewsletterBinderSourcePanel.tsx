import '../../insurer-news/components/collections/newsletterCollections.css'
import { useEffect, useState, type RefObject } from 'react'
import { FormButton } from '../../../components/form'
import { StatusMessage } from '../../../components/feedback'
import { useAuth } from '../../auth/AuthProvider'
import { isPublicGeneralAccount } from '../../auth/generalGa'
import { NewsletterPickerPanel } from '../../insurer-news/components/collections/NewsletterPickerPanel'
import { summarizeNewsletterImport } from '../../insurer-news/components/collections/newsletterImportSummary'
import { useNewsletterCollections } from '../../insurer-news/components/collections/useNewsletterCollections'
import { importNewslettersToBinder } from '../../insurer-news/services/newsletterCollections.service'

/**
 * 바인더 [자료 추가] 의 세 번째 출처 '소식지'.
 * 선택한 소식지를 서버에서 A4 PDF 로 변환해 기존 바인더 자료 등록 경로로 섹션에 담는다.
 */
export function NewsletterBinderSourcePanel({
  sectionId,
  sectionTitle,
  onImported,
  onSelectedCountChange,
  onBusyChange,
  submitActionRef,
  hideFooter = false,
}: {
  sectionId: string
  sectionTitle: string
  onImported: (message: string) => void
  onSelectedCountChange?: (count: number) => void
  onBusyChange?: (busy: boolean) => void
  submitActionRef?: RefObject<(() => void) | null>
  hideFooter?: boolean
}) {
  const { user, token } = useAuth()
  const blocked = isPublicGeneralAccount(user)
  const collections = useNewsletterCollections(token, !blocked)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    onSelectedCountChange?.(selected.length)
  }, [onSelectedCountChange, selected.length])

  useEffect(() => {
    onBusyChange?.(busy)
  }, [busy, onBusyChange])

  const submit = async () => {
    if (busy || selected.length === 0) return
    setBusy(true)
    setError('')
    try {
      const response = await importNewslettersToBinder(token, sectionId, selected)
      const message = summarizeNewsletterImport(response, `'${sectionTitle}' 섹션`)
      if (response.succeeded === 0) {
        setError(message)
        return
      }
      onImported(message)
    } catch (e) {
      setError(e instanceof Error ? e.message : '소식지를 담지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  if (submitActionRef) {
    submitActionRef.current = () => {
      void submit()
    }
  }

  if (blocked) {
    return <p className="personal-binder-material-picker__empty">이 계정에서는 소식지를 이용할 수 없습니다.</p>
  }

  return (
    <div className="newsletter-binder-source">
      <div className="newsletter-binder-source__target">
        담을 위치: <strong>{sectionTitle || '선택한 섹션'}</strong> · A4 PDF로 변환해 담습니다
      </div>
      {error ? <StatusMessage message={error} tone="error" className="m-0 newsletter-binder-source__error" /> : null}
      <NewsletterPickerPanel
        collections={collections.data}
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
      />
      {hideFooter ? null : (
        <div className="newsletter-binder-source__footer">
          <FormButton
            variant="primary"
            size="sm"
            loading={busy}
            loadingText="PDF 변환 중…"
            disabled={selected.length === 0}
            onClick={() => void submit()}
          >
            {selected.length}개 바인더에 담기
          </FormButton>
        </div>
      )}
    </div>
  )
}
