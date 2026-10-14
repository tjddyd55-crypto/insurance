import { useEffect, useState } from 'react'
import { BaseDialog } from '../../../../components/dialog/BaseDialog'
import { FormButton, FormInput } from '../../../../components/form'

export function NewsletterFolderNameDialog({
  open,
  title,
  initialName = '',
  confirmLabel = '저장',
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  initialName?: string
  confirmLabel?: string
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
}) {
  const [name, setName] = useState(initialName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName(initialName)
      setError('')
      setBusy(false)
    }
  }, [open, initialName])

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('폴더 이름을 입력해 주세요.')
      return
    }
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onSubmit(trimmed)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BaseDialog open={open} onClose={onClose} closeOnBackdrop={false} usePortal ariaLabel={title}>
      <div className="newsletter-collections-dialog">
        <h2 className="newsletter-collections-dialog__title">{title}</h2>
        <FormInput
          value={name}
          maxLength={80}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) void submit()
          }}
          placeholder="예: 암보험 자료"
          aria-label="폴더 이름"
        />
        {error ? <p className="newsletter-collections-dialog__error" role="alert">{error}</p> : null}
        <div className="newsletter-collections-dialog__actions">
          <FormButton variant="secondary" size="sm" onClick={onClose}>취소</FormButton>
          <FormButton variant="primary" size="sm" loading={busy} onClick={() => void submit()}>
            {confirmLabel}
          </FormButton>
        </div>
      </div>
    </BaseDialog>
  )
}
