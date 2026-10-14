import { useEffect, useState } from 'react'
import { BaseDialog } from '../../../../components/dialog/BaseDialog'
import { FormButton, FormInput } from '../../../../components/form'
import {
  addNewslettersToFolder,
  createNewsletterFolder,
  type NewsletterCollections,
} from '../../services/newsletterCollections.service'

/** [내 폴더에 담기] — 여러 폴더 선택 + 새 폴더 만들기. */
export function NewsletterAddToFolderDialog({
  open,
  token,
  newsletterIds,
  collections,
  onClose,
  onDone,
}: {
  open: boolean
  token: string | null | undefined
  newsletterIds: string[]
  collections: NewsletterCollections
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [checked, setChecked] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setChecked([])
      setNewName('')
      setError('')
      setBusy(false)
    }
  }, [open])

  const single = newsletterIds.length === 1 ? newsletterIds[0] : null

  const submit = async () => {
    if (busy) return
    const name = newName.trim()
    if (checked.length === 0 && !name) {
      setError('담을 폴더를 선택하거나 새 폴더 이름을 입력해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const targets = [...checked]
      const names: string[] = collections.folders.filter((f) => checked.includes(f.id)).map((f) => f.name)
      if (name) {
        const created = await createNewsletterFolder(token, name)
        targets.push(created.id)
        names.push(created.name)
      }
      let duplicates = 0
      for (const folderId of targets) {
        const r = await addNewslettersToFolder(token, folderId, newsletterIds)
        duplicates += r.duplicates.length
        if (r.rejected.length) throw new Error('볼 수 없는 소식지는 폴더에 담을 수 없습니다.')
      }
      onDone(
        `${names.map((n) => `'${n}'`).join(', ')}에 담았습니다.${duplicates ? ' (이미 있던 항목은 건너뜀)' : ''}`,
      )
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '폴더에 담지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BaseDialog open={open} onClose={onClose} closeOnBackdrop={false} usePortal ariaLabel="내 폴더에 담기">
      <div className="newsletter-collections-dialog">
        <h2 className="newsletter-collections-dialog__title">내 폴더에 담기</h2>
        {collections.folders.length === 0 ? (
          <p className="newsletter-collections-dialog__hint">아직 폴더가 없습니다. 새 폴더를 만들어 담아 보세요.</p>
        ) : (
          <ul className="newsletter-collections-dialog__folders">
            {collections.folders.map((folder) => {
              const already = single != null && folder.newsletterIds.includes(single)
              return (
                <li key={folder.id}>
                  <label className="newsletter-collections-dialog__folder">
                    <FormInput
                      type="checkbox"
                      checked={already || checked.includes(folder.id)}
                      disabled={already}
                      onChange={() =>
                        setChecked((prev) =>
                          prev.includes(folder.id) ? prev.filter((v) => v !== folder.id) : [...prev, folder.id],
                        )
                      }
                    />
                    <span>{folder.name}</span>
                    <span className="newsletter-collections-dialog__folder-meta">
                      {already ? '담김' : `${folder.count}개`}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
        <FormInput
          value={newName}
          maxLength={80}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="+ 새 폴더 이름 (선택)"
          aria-label="새 폴더 이름"
        />
        {error ? <p className="newsletter-collections-dialog__error" role="alert">{error}</p> : null}
        <div className="newsletter-collections-dialog__actions">
          <FormButton variant="secondary" size="sm" onClick={onClose}>취소</FormButton>
          <FormButton variant="primary" size="sm" loading={busy} onClick={() => void submit()}>담기</FormButton>
        </div>
      </div>
    </BaseDialog>
  )
}
