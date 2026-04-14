import { FormButton, FormInput } from '../../../components/form'
import type { StorageFolderRow } from '../api/storageApi'
import FolderPicker from './FolderPicker'

type FolderOption = StorageFolderRow | { id: null; name: '전체'; createdAt: string }

type StorageToolbarProps = {
  isMobile: boolean
  folderOptions: FolderOption[]
  selectedFolderId: number | null
  folderPickerOpen: boolean
  onOpenFolderPicker: () => void
  onCloseFolderPicker: () => void
  onSelectFolder: (folderId: number | null) => void
  onOpenCreateFolder: () => void
  onUploadFiles: (files: FileList | null) => void
  uploading: boolean
}

export default function StorageToolbar({
  isMobile,
  folderOptions,
  selectedFolderId,
  folderPickerOpen,
  onOpenFolderPicker,
  onCloseFolderPicker,
  onSelectFolder,
  onOpenCreateFolder,
  onUploadFiles,
  uploading,
}: StorageToolbarProps) {
  return (
    <div className={`storage-toolbar${isMobile ? ' storage-toolbar--mobile' : ''}`}>
      <div className="storage-toolbar__row">
        <FormButton htmlType="button" variant="secondary" onClick={onOpenCreateFolder}>
          폴더 생성
        </FormButton>
        <FolderPicker
          folders={folderOptions}
          selectedFolderId={selectedFolderId}
          isMobile={isMobile}
          isOpen={folderPickerOpen}
          onOpen={onOpenFolderPicker}
          onClose={onCloseFolderPicker}
          onSelect={onSelectFolder}
        />
        {!isMobile ? (
          <label className="storage-toolbar__upload">
            <FormInput
              type="file"
              multiple
              accept="image/jpeg,image/png,application/pdf,.pdf"
              onChange={(event) => {
                onUploadFiles(event.target.files)
                event.target.value = ''
              }}
              disabled={uploading}
            />
            <span>{uploading ? '업로드 중…' : '파일 업로드'}</span>
          </label>
        ) : null}
      </div>
      {isMobile ? (
        <div className="storage-toolbar__row">
          <label className="storage-toolbar__upload storage-toolbar__upload--mobile">
            <FormInput
              type="file"
              multiple
              accept="image/jpeg,image/png,application/pdf,.pdf"
              onChange={(event) => {
                onUploadFiles(event.target.files)
                event.target.value = ''
              }}
              disabled={uploading}
            />
            <span>{uploading ? '업로드 중…' : '파일 업로드'}</span>
          </label>
        </div>
      ) : null}
    </div>
  )
}
