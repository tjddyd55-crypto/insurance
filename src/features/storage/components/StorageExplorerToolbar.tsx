import FileUploader from '../../../components/common/FileUploader'
import { FormButton } from '../../../components/form'

type StorageExplorerToolbarProps = {
  selectedFolderPath: string
  searchText: string
  kindFilter: 'all' | 'image' | 'pdf' | 'spreadsheet'
  sortOrder: 'name' | 'date-desc'
  uploading: boolean
  onSearchChange: (value: string) => void
  onKindFilterChange: (value: 'all' | 'image' | 'pdf' | 'spreadsheet') => void
  onSortOrderChange: (value: 'name' | 'date-desc') => void
  onResetFilters: () => void
  onOpenCreateFolder: () => void
  validateUploadFile: (file: File) => string | null
  onUploadFiles: (files: File[]) => void
  onUploadInvalidBatch?: (failures: { file: File; message: string }[]) => void
}

export default function StorageExplorerToolbar({
  selectedFolderPath,
  searchText,
  kindFilter,
  sortOrder,
  uploading,
  onSearchChange,
  onKindFilterChange,
  onSortOrderChange,
  onResetFilters,
  onOpenCreateFolder,
  validateUploadFile,
  onUploadFiles,
  onUploadInvalidBatch,
}: StorageExplorerToolbarProps) {
  const hasActiveFilters = Boolean(searchText.trim()) || kindFilter !== 'all' || sortOrder !== 'date-desc'

  return (
    <div className="storage-explorer-toolbar">
      <div className="storage-explorer-toolbar__left">
        <div className="storage-explorer-toolbar__location" role="status">
          <span className="storage-explorer-toolbar__location-label">현재 폴더</span>
          <strong className="storage-explorer-toolbar__location-path">{selectedFolderPath}</strong>
        </div>
        <FormButton htmlType="button" variant="secondary" size="sm" onClick={onOpenCreateFolder}>
          폴더 생성
        </FormButton>
      </div>

      <div className="storage-explorer-toolbar__center">
        <FileUploader
          accept="image/jpeg,image/png,application/pdf,.pdf,.xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          validateFile={validateUploadFile}
          onFiles={onUploadFiles}
          onInvalidBatch={onUploadInvalidBatch}
          compact
          disabled={uploading}
          statusText={uploading ? '업로드 중…' : undefined}
          primaryHint="파일을 드래그하거나 클릭하여 업로드"
          hintLines={[
            `현재 폴더: ${selectedFolderPath}`,
            'JPG · PNG · PDF · XLS · XLSX · CSV, 파일당 최대 25MB',
          ]}
        />
      </div>

      <div className="storage-explorer-toolbar__right" role="search">
        <input
          type="search"
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="현재 폴더에서 파일명 검색"
          className="storage-explorer-toolbar__search user-form-control"
        />
        <select
          value={kindFilter}
          onChange={(event) =>
            onKindFilterChange(event.target.value as 'all' | 'image' | 'pdf' | 'spreadsheet')
          }
          className="storage-explorer-toolbar__select"
          aria-label="파일 종류 필터"
        >
          <option value="all">전체 형식</option>
          <option value="image">이미지</option>
          <option value="pdf">PDF</option>
          <option value="spreadsheet">엑셀/CSV</option>
        </select>
        <select
          value={sortOrder}
          onChange={(event) => onSortOrderChange(event.target.value as 'name' | 'date-desc')}
          className="storage-explorer-toolbar__select"
          aria-label="정렬"
        >
          <option value="date-desc">최신순</option>
          <option value="name">이름순</option>
        </select>
        {hasActiveFilters ? (
          <button type="button" className="storage-explorer-toolbar__reset" onClick={onResetFilters}>
            초기화
          </button>
        ) : null}
      </div>
    </div>
  )
}
