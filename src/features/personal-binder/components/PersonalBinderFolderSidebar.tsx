import { useState } from 'react'

import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { useConfirmDialog } from '../../../components/dialog'
import FormButton from '../../../components/form/FormButton'
import FormInput from '../../../components/form/FormInput'
import type { PersonalBinderFolder } from '../personalBinder.types'
import type { PersonalBinderFolderSelection } from '../domain/personalBinderFolderFilter'

type Props = {
  heading: string
  allLabel: string
  folders: PersonalBinderFolder[]
  selection: PersonalBinderFolderSelection
  onSelect: (next: PersonalBinderFolderSelection) => void
  countForSelection: (selection: PersonalBinderFolderSelection) => number
  countForFolder: (folderId: string) => number
  onCreateFolder: (name: string) => Promise<void>
  onRenameFolder: (folderId: string, name: string) => Promise<void>
  onDeleteFolder: (folderId: string) => Promise<void>
  disabled?: boolean
}

export function PersonalBinderFolderSidebar({
  heading,
  allLabel,
  folders,
  selection,
  onSelect,
  countForSelection,
  countForFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  disabled = false,
}: Props) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [menuFolderId, setMenuFolderId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [renameFolder, setRenameFolder] = useState<PersonalBinderFolder | null>(null)
  const [draftName, setDraftName] = useState('')
  const [busy, setBusy] = useState(false)

  const openCreate = () => {
    setDraftName('')
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    const name = draftName.trim()
    if (!name || busy) return
    setBusy(true)
    try {
      await onCreateFolder(name)
      setCreateOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const submitRename = async () => {
    if (!renameFolder || !draftName.trim() || busy) return
    setBusy(true)
    try {
      await onRenameFolder(renameFolder.id, draftName.trim())
      setRenameFolder(null)
    } finally {
      setBusy(false)
    }
  }

  const removeFolder = async (folder: PersonalBinderFolder) => {
    setMenuFolderId(null)
    const accepted = await confirm({
      title: '폴더를 삭제할까요?',
      message: `“${folder.name}” 폴더만 삭제됩니다. 안의 항목은 미분류로 이동합니다.`,
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'danger',
    })
    if (!accepted) return
    setBusy(true)
    try {
      await onDeleteFolder(folder.id)
      if (selection === folder.id) {
        onSelect('all')
      }
    } finally {
      setBusy(false)
    }
  }

  const renderNavButton = (
    key: PersonalBinderFolderSelection,
    label: string,
    count: number,
  ) => (
    <button
      key={key}
      type="button"
      className={`personal-binder-folder-nav__item${
        selection === key ? ' personal-binder-folder-nav__item--active' : ''
      }`}
      disabled={disabled}
      onClick={() => onSelect(key)}
    >
      <span className="personal-binder-folder-nav__label">{label}</span>
      <span className="personal-binder-folder-nav__count">{count}</span>
    </button>
  )

  return (
    <aside className="personal-binder-folder-sidebar" aria-label={heading}>
      <h2 className="personal-binder-folder-sidebar__title">{heading}</h2>
      <nav className="personal-binder-folder-nav">
        {renderNavButton('all', allLabel, countForSelection('all'))}
        <div className="personal-binder-folder-nav__divider" role="presentation" />
        {renderNavButton('uncategorized', '미분류', countForSelection('uncategorized'))}
        {folders.map((folder) => (
          <div key={folder.id} className="personal-binder-folder-nav__row">
            <button
              type="button"
              className={`personal-binder-folder-nav__item${
                selection === folder.id ? ' personal-binder-folder-nav__item--active' : ''
              }`}
              disabled={disabled}
              onClick={() => onSelect(folder.id)}
            >
              <span className="personal-binder-folder-nav__label">{folder.name}</span>
              <span className="personal-binder-folder-nav__count">
                {countForFolder(folder.id)}
              </span>
            </button>
            <button
              type="button"
              className="personal-binder-folder-nav__menu"
              disabled={disabled || busy}
              aria-label={`${folder.name} 폴더 메뉴`}
              aria-expanded={menuFolderId === folder.id}
              onClick={() =>
                setMenuFolderId((current) => (current === folder.id ? null : folder.id))
              }
            >
              ⋯
            </button>
            {menuFolderId === folder.id ? (
              <div className="personal-binder-folder-nav__menu-panel" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuFolderId(null)
                    setRenameFolder(folder)
                    setDraftName(folder.name)
                  }}
                >
                  이름 변경
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="personal-binder-folder-nav__menu-danger"
                  onClick={() => void removeFolder(folder)}
                >
                  삭제
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </nav>
      <FormButton
        variant="secondary"
        size="sm"
        fullWidth
        disabled={disabled || busy}
        onClick={openCreate}
      >
        + 폴더 만들기
      </FormButton>

      <BaseDialog
        open={createOpen}
        onClose={() => !busy && setCreateOpen(false)}
        closeOnBackdrop={false}
        ariaLabel="폴더 만들기"
      >
        <h3 className="personal-binder-dialog-title">폴더 만들기</h3>
        <FormInput
          value={draftName}
          disabled={busy}
          onChange={(event) => setDraftName(event.target.value)}
          placeholder="폴더 이름"
          aria-label="폴더 이름"
        />
        <div className="personal-binder-dialog-actions">
          <FormButton variant="secondary" disabled={busy} onClick={() => setCreateOpen(false)}>
            취소
          </FormButton>
          <FormButton
            variant="primary"
            loading={busy}
            disabled={!draftName.trim()}
            onClick={() => void submitCreate()}
          >
            만들기
          </FormButton>
        </div>
      </BaseDialog>

      <BaseDialog
        open={renameFolder != null}
        onClose={() => !busy && setRenameFolder(null)}
        closeOnBackdrop={false}
        ariaLabel="폴더 이름 변경"
      >
        <h3 className="personal-binder-dialog-title">폴더 이름 변경</h3>
        <FormInput
          value={draftName}
          disabled={busy}
          onChange={(event) => setDraftName(event.target.value)}
          aria-label="폴더 이름"
        />
        <div className="personal-binder-dialog-actions">
          <FormButton variant="secondary" disabled={busy} onClick={() => setRenameFolder(null)}>
            취소
          </FormButton>
          <FormButton
            variant="primary"
            loading={busy}
            disabled={!draftName.trim()}
            onClick={() => void submitRename()}
          >
            저장
          </FormButton>
        </div>
      </BaseDialog>
      {confirmDialog}
    </aside>
  )
}
