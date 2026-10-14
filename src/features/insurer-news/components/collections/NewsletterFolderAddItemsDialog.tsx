import { useEffect, useMemo, useState } from 'react'
import { BaseDialog } from '../../../../components/dialog/BaseDialog'
import { FormButton } from '../../../../components/form'
import type { NewsletterItem } from '../../types'
import {
  addNewslettersToFolder,
  type NewsletterCollections,
  type NewsletterUserFolder,
} from '../../services/newsletterCollections.service'
import { NewsletterPickerPanel } from './NewsletterPickerPanel'

/** 폴더 안 [소식지 추가] — 기존 검색·원수사 구분을 재사용한 다중 선택 일괄 추가. */
export function NewsletterFolderAddItemsDialog({
  open,
  token,
  folder,
  items,
  collections,
  onClose,
  onAdded,
}: {
  open: boolean
  token: string | null | undefined
  folder: NewsletterUserFolder | null
  items: NewsletterItem[]
  collections: NewsletterCollections
  onClose: () => void
  onAdded: (message: string) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setSelected([])
      setError('')
      setBusy(false)
    }
  }, [open])

  const already = useMemo(() => new Set(folder?.newsletterIds ?? []), [folder])

  const submit = async () => {
    if (!folder || busy || selected.length === 0) return
    setBusy(true)
    setError('')
    try {
      const r = await addNewslettersToFolder(token, folder.id, selected)
      const parts = [`${r.added.length}개를 '${folder.name}'에 담았습니다.`]
      if (r.duplicates.length) parts.push(`${r.duplicates.length}개는 이미 있습니다.`)
      if (r.rejected.length) parts.push(`${r.rejected.length}개는 볼 수 없는 소식지라 제외했습니다.`)
      onAdded(parts.join(' '))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BaseDialog
      open={open && folder != null}
      onClose={onClose}
      closeOnBackdrop={false}
      usePortal
      panelPreset="largeForm"
      panelClassName="newsletter-collections-large-dialog"
      ariaLabel="소식지 추가"
    >
      <div className="newsletter-collections-large-dialog__shell">
        <header className="newsletter-collections-large-dialog__header">
          <h2>소식지 추가 · {folder?.name}</h2>
          <FormButton variant="secondary" size="sm" onClick={onClose}>닫기</FormButton>
        </header>
        <div className="newsletter-collections-large-dialog__body">
          <NewsletterPickerPanel
            items={items}
            collections={collections}
            selectedIds={selected}
            onSelectedIdsChange={setSelected}
            disabledIds={already}
            showSourceFilter={false}
          />
        </div>
        {error ? <p className="newsletter-collections-dialog__error" role="alert">{error}</p> : null}
        <footer className="newsletter-collections-large-dialog__footer">
          <FormButton variant="secondary" size="sm" onClick={onClose}>취소</FormButton>
          <FormButton
            variant="primary"
            size="sm"
            loading={busy}
            disabled={selected.length === 0}
            onClick={() => void submit()}
          >
            {selected.length}개 추가
          </FormButton>
        </footer>
      </div>
    </BaseDialog>
  )
}
