import { useMemo, useState } from 'react'

import { BaseDialog } from '../../../components/dialog/BaseDialog'
import FormButton from '../../../components/form/FormButton'
import type { PersonalBinder } from '../personalBinder.types'
import {
  revokeSharedPersonalBinder,
  sharePersonalBinderToGa,
  type BinderShareStatus,
} from '../personalBinderShare.api'

type Props = {
  open: boolean
  onClose: () => void
  token: string
  binder: PersonalBinder
  shareStatus: BinderShareStatus | null
  gaLabel?: string
  onChanged: () => void
}

export function PersonalBinderShareDialog({
  open,
  onClose,
  token,
  binder,
  shareStatus,
  gaLabel = '현재 소속 GA 지점',
  onChanged,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false)

  const stats = useMemo(() => {
    let fileCount = 0
    for (const section of binder.sections) {
      fileCount += section.items.length
    }
    return {
      sectionCount: binder.sections.length,
      fileCount,
    }
  }, [binder.sections])

  const filePreview = useMemo(() => {
    const names: string[] = []
    for (const section of binder.sections) {
      for (const item of section.items) {
        names.push(item.material.originalFileName || item.material.title)
      }
    }
    return names.slice(0, 12)
  }, [binder.sections])

  const activeShare = shareStatus?.active

  const runShare = async () => {
    setBusy(true)
    setError('')
    try {
      await sharePersonalBinderToGa(token, binder.id)
      onChanged()
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '공유에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const runRevoke = async () => {
    if (!activeShare?.shareId) return
    setBusy(true)
    setError('')
    try {
      await revokeSharedPersonalBinder(token, activeShare.shareId)
      onChanged()
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '공유 해제에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BaseDialog open={open} onClose={onClose} closeOnBackdrop={!busy} ariaLabel="지점 공유">
      <h2 className="personal-binder-dialog-title">지점에 공유하기</h2>
      <p className="personal-binder-dialog-lead">
        공유하면 같은 지점 사용자가 열람하고 자신의 바인더로 가져갈 수 있습니다. 개인정보가 포함된
        자료는 공유 전 목록을 확인해 주세요.
      </p>
      <dl className="personal-binder-share-dialog__meta">
        <div>
          <dt>바인더</dt>
          <dd>{binder.title}</dd>
        </div>
        <div>
          <dt>섹션</dt>
          <dd>{stats.sectionCount}개</dd>
        </div>
        <div>
          <dt>자료</dt>
          <dd>{stats.fileCount}개</dd>
        </div>
        <div>
          <dt>공유 범위</dt>
          <dd>{gaLabel}</dd>
        </div>
      </dl>
      {filePreview.length > 0 ? (
        <ul className="personal-binder-share-dialog__files" aria-label="포함 파일 목록">
          {filePreview.map((name) => (
            <li key={name}>{name}</li>
          ))}
          {stats.fileCount > filePreview.length ? (
            <li>외 {stats.fileCount - filePreview.length}개</li>
          ) : null}
        </ul>
      ) : null}
      {!activeShare ? (
        <label className="personal-binder-share-dialog__ack">
          <input
            type="checkbox"
            checked={privacyAcknowledged}
            onChange={(event) => setPrivacyAcknowledged(event.target.checked)}
          />
          <span>
            포함된 파일 목록을 확인했으며, 고객 개인정보·민감정보가 포함될 수 있음을 이해하고
            지점 공유에 동의합니다.
          </span>
        </label>
      ) : null}
      {error ? <p className="personal-binder-error">{error}</p> : null}
      <div className="personal-binder-dialog-actions">
        <FormButton variant="secondary" onClick={onClose} disabled={busy}>
          닫기
        </FormButton>
        {activeShare ? (
          <FormButton variant="danger" loading={busy} onClick={() => void runRevoke()}>
            공유 해제
          </FormButton>
        ) : (
          <FormButton
            variant="primary"
            loading={busy}
            disabled={!privacyAcknowledged}
            onClick={() => void runShare()}
          >
            공유하기
          </FormButton>
        )}
      </div>
    </BaseDialog>
  )
}
