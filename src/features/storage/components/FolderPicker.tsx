import { FormButton, FormSelect } from '../../../components/form'

function folderSheetOptionClass(active: boolean): string {
  return `ui-button ui-button--md ui-button--full ${active ? 'ui-button--primary' : 'ui-button--secondary'}`
}
import Modal from '../../../components/ui/Modal'
import { CustomerWorkspaceSecondaryActionButton } from '../../customers/components/CustomerWorkspaceActionButtons'
import type { StorageActionVariant } from './StorageFileList'
import type { StorageFolderRow } from '../api/storageApi'

type FolderOption = StorageFolderRow | { id: null; name: '전체'; createdAt: string }

type FolderPickerProps = {
  folders: FolderOption[]
  selectedFolderId: number | null
  isMobile: boolean
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onSelect: (folderId: number | null) => void
  actionVariant?: StorageActionVariant
}

export default function FolderPicker({
  folders,
  selectedFolderId,
  isMobile,
  isOpen,
  onOpen,
  onClose,
  onSelect,
  actionVariant = 'storage',
}: FolderPickerProps) {
  if (!isMobile) {
    const selectOptions = folders.map((folder) => ({
      value: folder.id == null ? 'all' : String(folder.id),
      label: folder.name,
    }))
    return (
      <FormSelect
        value={selectedFolderId == null ? 'all' : String(selectedFolderId)}
        onChange={(event) => {
          const value = event.target.value
          onSelect(value === 'all' ? null : Number(value))
        }}
        className="storage-toolbar__folder-select"
        options={selectOptions}
      />
    )
  }

  const selected = folders.find((folder) => folder.id === selectedFolderId) ?? folders[0]

  return (
    <>
      {actionVariant === 'workspace' ? (
        <CustomerWorkspaceSecondaryActionButton
          className="storage-toolbar__workspace-control storage-toolbar__folder-trigger storage-toolbar__folder-trigger--workspace"
          onClick={onOpen}
        >
          {selected?.name ?? '전체'} ▼
        </CustomerWorkspaceSecondaryActionButton>
      ) : (
        <FormButton htmlType="button" variant="secondary" className="storage-toolbar__folder-trigger" onClick={onOpen}>
          {selected?.name ?? '전체'} ▼
        </FormButton>
      )}

      <Modal open={isOpen} onClose={onClose} ariaLabel="폴더 선택" panelClassName="storage-folder-sheet">
        <header className="storage-folder-sheet__header">
          <h2 className="storage-folder-sheet__title">폴더 선택</h2>
        </header>
        <div className="storage-folder-sheet__body">
          <div className="storage-folder-sheet__list" role="listbox" aria-label="폴더 목록">
            {folders.map((folder) => {
              const active = folder.id === selectedFolderId
              return (
                <button
                  key={folder.id == null ? 'all' : String(folder.id)}
                  type="button"
                  className={folderSheetOptionClass(active)}
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onSelect(folder.id)
                    onClose()
                  }}
                >
                  {folder.name}
                </button>
              )
            })}
          </div>
        </div>
      </Modal>
    </>
  )
}
