import { useMemo, useState } from 'react'

import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { useConfirmDialog } from '../../../components/dialog'
import FormButton from '../../../components/form/FormButton'
import FormInput from '../../../components/form/FormInput'
import { countItemsInFolderSelection } from '../domain/personalBinderFolderFilter'
import type { PersonalBinderFolder, PersonalBinderSummary } from '../personalBinder.types'

type Props = {
  binders: PersonalBinderSummary[]
  folders: PersonalBinderFolder[]
  selectedBinderId?: string
  onSelectBinder: (binderId: string) => void | Promise<void>
  onCreateBinder: () => void
  onCreateFolder: (name: string) => Promise<void>
  onRenameFolder: (folderId: string, name: string) => Promise<void>
  onDeleteFolder: (folderId: string) => Promise<void>
  disabled?: boolean
}

function sortByTitle<T extends { title: string }>(rows: T[]): T[] {
  return rows.slice().sort((left, right) => left.title.localeCompare(right.title, 'ko'))
}

export function PersonalBinderExplorerTree({
  binders,
  folders,
  selectedBinderId,
  onSelectBinder,
  onCreateBinder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  disabled = false,
}: Props) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => ({
    __all__: true,
    __uncategorized__: true,
  }))
  const [menuFolderId, setMenuFolderId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [renameFolder, setRenameFolder] = useState<PersonalBinderFolder | null>(null)
  const [draftName, setDraftName] = useState('')
  const [busy, setBusy] = useState(false)

  const bindersByFolder = useMemo(() => {
    const map = new Map<string, PersonalBinderSummary[]>()
    for (const folder of folders) {
      map.set(folder.id, [])
    }
    const uncategorized: PersonalBinderSummary[] = []
    for (const binder of binders) {
      if (binder.folderId && map.has(binder.folderId)) {
        map.get(binder.folderId)?.push(binder)
      } else if (!binder.folderId) {
        uncategorized.push(binder)
      }
    }
    for (const [key, rows] of map) {
      map.set(key, sortByTitle(rows))
    }
    return { map, uncategorized: sortByTitle(uncategorized), all: sortByTitle(binders) }
  }, [binders, folders])

  const isExpanded = (key: string) => expanded[key] !== false

  const toggleExpanded = (key: string) => {
    setExpanded((current) => ({ ...current, [key]: !isExpanded(key) }))
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
      message: `“${folder.name}” 폴더만 삭제됩니다. 안의 바인더는 미분류로 이동합니다.`,
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'danger',
    })
    if (!accepted) return
    setBusy(true)
    try {
      await onDeleteFolder(folder.id)
    } finally {
      setBusy(false)
    }
  }

  const renderBinderRow = (binder: PersonalBinderSummary) => {
    const active = selectedBinderId === binder.id
    return (
      <button
        key={binder.id}
        type="button"
        className={[
          'personal-binder-explorer-tree__binder',
          active ? 'personal-binder-explorer-tree__binder--active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        disabled={disabled}
        onClick={() => void onSelectBinder(binder.id)}
      >
        <span className="personal-binder-explorer-tree__binder-title" title={binder.title}>
          {binder.title}
        </span>
        <span className="personal-binder-explorer-tree__binder-meta">
          {binder.sectionCount}섹션 · {binder.materialCount}자료
        </span>
      </button>
    )
  }

  const renderFolderGroup = (folder: PersonalBinderFolder) => {
    const key = folder.id
    const rows = bindersByFolder.map.get(folder.id) ?? []
    const open = isExpanded(key)
    return (
      <div key={folder.id} className="personal-binder-explorer-tree__group">
        <div className="personal-binder-explorer-tree__folder-row">
          <button
            type="button"
            className="personal-binder-explorer-tree__folder-toggle"
            disabled={disabled}
            aria-expanded={open}
            onClick={() => toggleExpanded(key)}
          >
            <span className="personal-binder-explorer-tree__chevron" aria-hidden="true">
              {open ? '▼' : '▶'}
            </span>
            <span className="personal-binder-explorer-tree__folder-label" title={folder.name}>
              {folder.name}
            </span>
            <span className="personal-binder-explorer-tree__count">{rows.length}</span>
          </button>
          <button
            type="button"
            className="personal-binder-explorer-tree__folder-menu"
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
            <div className="personal-binder-explorer-tree__menu-panel" role="menu">
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
                className="personal-binder-explorer-tree__menu-danger"
                onClick={() => void removeFolder(folder)}
              >
                삭제
              </button>
            </div>
          ) : null}
        </div>
        {open ? (
          <div className="personal-binder-explorer-tree__children">
            {rows.length === 0 ? (
              <p className="personal-binder-explorer-tree__empty">바인더 없음</p>
            ) : (
              rows.map((binder) => renderBinderRow(binder))
            )}
          </div>
        ) : null}
      </div>
    )
  }

  const allCount = countItemsInFolderSelection(binders, 'all')
  const uncategorizedCount = countItemsInFolderSelection(binders, 'uncategorized')
  const allOpen = isExpanded('__all__')
  const uncategorizedOpen = isExpanded('__uncategorized__')

  return (
    <aside className="personal-binder-explorer-tree" aria-label="바인더 탐색">
      <div className="personal-binder-explorer-tree__header">
        <h2 className="personal-binder-explorer-tree__title">내 바인더</h2>
        <div className="personal-binder-explorer-tree__header-actions">
          <FormButton variant="secondary" size="sm" disabled={disabled || busy} onClick={onCreateBinder}>
            + 바인더
          </FormButton>
        </div>
      </div>

      <div className="personal-binder-explorer-tree__body">
        <div className="personal-binder-explorer-tree__group">
          <button
            type="button"
            className="personal-binder-explorer-tree__folder-toggle personal-binder-explorer-tree__folder-toggle--root"
            disabled={disabled}
            aria-expanded={allOpen}
            onClick={() => toggleExpanded('__all__')}
          >
            <span className="personal-binder-explorer-tree__chevron" aria-hidden="true">
              {allOpen ? '▼' : '▶'}
            </span>
            <span className="personal-binder-explorer-tree__folder-label">전체 바인더</span>
            <span className="personal-binder-explorer-tree__count">{allCount}</span>
          </button>
          {allOpen ? (
            <div className="personal-binder-explorer-tree__children personal-binder-explorer-tree__children--flat">
              {bindersByFolder.all.length === 0 ? (
                <p className="personal-binder-explorer-tree__empty">바인더가 없습니다.</p>
              ) : (
                bindersByFolder.all.map((binder) => renderBinderRow(binder))
              )}
            </div>
          ) : null}
        </div>

        {folders.map((folder) => renderFolderGroup(folder))}

        <div className="personal-binder-explorer-tree__group">
          <button
            type="button"
            className="personal-binder-explorer-tree__folder-toggle personal-binder-explorer-tree__folder-toggle--root"
            disabled={disabled}
            aria-expanded={uncategorizedOpen}
            onClick={() => toggleExpanded('__uncategorized__')}
          >
            <span className="personal-binder-explorer-tree__chevron" aria-hidden="true">
              {uncategorizedOpen ? '▼' : '▶'}
            </span>
            <span className="personal-binder-explorer-tree__folder-label">미분류</span>
            <span className="personal-binder-explorer-tree__count">{uncategorizedCount}</span>
          </button>
          {uncategorizedOpen ? (
            <div className="personal-binder-explorer-tree__children">
              {bindersByFolder.uncategorized.length === 0 ? (
                <p className="personal-binder-explorer-tree__empty">바인더 없음</p>
              ) : (
                bindersByFolder.uncategorized.map((binder) => renderBinderRow(binder))
              )}
            </div>
          ) : null}
        </div>
      </div>

      <FormButton
        variant="secondary"
        size="sm"
        fullWidth
        disabled={disabled || busy}
        onClick={() => {
          setDraftName('')
          setCreateOpen(true)
        }}
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
