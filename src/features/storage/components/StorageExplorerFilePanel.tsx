import { formatKstDateTimeDisplay } from '../../../utils/displayDateTime'
import type { StorageFileDownloadLinkEntry, StorageFileRow, StorageFolderRow } from '../api/storageApi'
import type { StorageActionVariant } from './StorageFileList'
import { resolveStorageFileFolderLabel } from '../utils/storageFolderTree'
import {
  CUSTOMER_WORKSPACE_ACTION_SECONDARY_CLASS,
  CustomerWorkspaceDangerActionButton,
  CustomerWorkspaceItemActions,
  CustomerWorkspaceSecondaryActionButton,
} from '../../customers/components/CustomerWorkspaceActionButtons'

const EXPLORER_FILE_ACTION_BUTTON_CLASS = 'storage-explorer-file-action-button'
const EXPLORER_FILE_ACTION_DANGER_CLASS =
  'storage-explorer-file-action-button storage-explorer-file-action-button--danger'

type StorageExplorerFilePanelProps = {
  breadcrumb: string[]
  folders: StorageFolderRow[]
  files: StorageFileRow[]
  isAllFilesView: boolean
  loading: boolean
  listFetchError?: string
  searchActive: boolean
  selectedFileId: number | null
  downloadLinksByFileId: Record<number, StorageFileDownloadLinkEntry>
  downloadLinkFailedIds: ReadonlySet<number>
  actionVariant?: StorageActionVariant
  onSelectFile: (id: number) => void
  onOpen: (file: StorageFileRow) => void
  onRename: (file: StorageFileRow) => void
  onDelete: (file: StorageFileRow) => void
  onSelectBreadcrumbFolder: (index: number) => void
}

function renderFileIcon(file: StorageFileRow): string {
  const mime = String(file.mimeType ?? '').toLowerCase()
  if (mime === 'application/pdf') {
    return '📄'
  }
  if (mime.startsWith('image/')) {
    return '🖼️'
  }
  if (mime.includes('spreadsheet') || mime.includes('excel') || file.fileName.toLowerCase().endsWith('.csv')) {
    return '📊'
  }
  return '📁'
}

function formatFileSize(bytes: number | null): string {
  if (!Number.isFinite(Number(bytes)) || Number(bytes) < 1) {
    return '0 KB'
  }
  const safeBytes = Number(bytes)
  if (safeBytes >= 1024 * 1024) {
    return `${(safeBytes / 1024 / 1024).toFixed(1)} MB`
  }
  return `${Math.ceil(safeBytes / 1024)} KB`
}

function inferFileExtension(file: StorageFileRow): string {
  const name = String(file.displayName || file.fileName || '').trim()
  const dot = name.lastIndexOf('.')
  if (dot > 0 && dot < name.length - 1) {
    return name.slice(dot + 1).toUpperCase()
  }
  const mime = String(file.mimeType ?? '').toLowerCase()
  if (mime.includes('pdf')) return 'PDF'
  if (mime.startsWith('image/')) return mime.split('/')[1]?.toUpperCase() ?? 'IMAGE'
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'XLSX'
  if (mime.includes('csv')) return 'CSV'
  return 'FILE'
}

export default function StorageExplorerFilePanel({
  breadcrumb,
  folders,
  files,
  isAllFilesView,
  loading,
  listFetchError = '',
  searchActive,
  selectedFileId,
  downloadLinksByFileId,
  downloadLinkFailedIds,
  actionVariant = 'storage',
  onSelectFile,
  onOpen,
  onRename,
  onDelete,
  onSelectBreadcrumbFolder,
}: StorageExplorerFilePanelProps) {
  return (
    <section className="storage-explorer-files" aria-label="파일 목록">
      <nav className="storage-explorer-files__breadcrumb" aria-label="현재 위치">
        {breadcrumb.map((segment, index) => {
          const isLast = index === breadcrumb.length - 1
          return (
            <span key={`${segment}-${index}`} className="storage-explorer-files__crumb">
              {index > 0 ? <span className="storage-explorer-files__crumb-sep">›</span> : null}
              {isLast ? (
                <span className="storage-explorer-files__crumb-current">{segment}</span>
              ) : (
                <button
                  type="button"
                  className="storage-explorer-files__crumb-link"
                  onClick={() => onSelectBreadcrumbFolder(index)}
                >
                  {segment}
                </button>
              )}
            </span>
          )
        })}
      </nav>

      {loading ? (
        <p className="storage-explorer-files__empty">불러오는 중…</p>
      ) : listFetchError.trim() ? (
        <p className="storage-explorer-files__empty" role="alert">
          {listFetchError.trim()}
        </p>
      ) : files.length === 0 ? (
        <p className="storage-explorer-files__empty">
          {searchActive ? '검색 결과 없음' : isAllFilesView ? '전체 파일 없음' : '선택된 폴더에 파일 없음'}
        </p>
      ) : (
        <div className="storage-explorer-files__list">
          <div className="storage-explorer-files__head" aria-hidden="true">
            <span>파일명</span>
            <span>유형</span>
            <span>크기</span>
            <span>등록일</span>
            <span>액션</span>
          </div>
          {files.map((file) => {
            const selected = selectedFileId === file.id
            const downloadEntry = downloadLinksByFileId[file.id]
            const downloadHref = downloadEntry?.href?.trim() ?? ''
            const downloadFailed = downloadLinkFailedIds.has(file.id)
            return (
              <div
                key={file.id}
                className={[
                  'storage-explorer-files__row',
                  selected ? 'storage-explorer-files__row--selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                role="button"
                tabIndex={0}
                onClick={() => onSelectFile(file.id)}
                onDoubleClick={() => onOpen(file)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectFile(file.id)
                  }
                }}
              >
                <div className="storage-explorer-files__name-cell">
                  <span className="storage-explorer-files__icon">{renderFileIcon(file)}</span>
                  <span className="storage-explorer-files__name-block">
                    <span className="storage-explorer-files__name">{file.displayName}</span>
                    {isAllFilesView ? (
                      <span className="storage-explorer-files__folder-path">
                        {resolveStorageFileFolderLabel(folders, file)}
                      </span>
                    ) : null}
                  </span>
                </div>
                <span className="storage-explorer-files__type">{inferFileExtension(file)}</span>
                <span className="storage-explorer-files__size">{formatFileSize(file.fileSize)}</span>
                <span className="storage-explorer-files__date">
                  {formatKstDateTimeDisplay(file.createdAt, '—')}
                </span>
                {actionVariant === 'workspace' ? (
                  <CustomerWorkspaceItemActions>
                    <CustomerWorkspaceSecondaryActionButton
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpen(file)
                      }}
                    >
                      열기
                    </CustomerWorkspaceSecondaryActionButton>
                    {downloadHref ? (
                      <a
                        href={downloadHref}
                        download
                        className={CUSTOMER_WORKSPACE_ACTION_SECONDARY_CLASS}
                        onClick={(event) => {
                          event.stopPropagation()
                        }}
                      >
                        다운로드
                      </a>
                    ) : (
                      <CustomerWorkspaceSecondaryActionButton
                        disabled
                        onClick={(event) => {
                          event.stopPropagation()
                        }}
                      >
                        {downloadFailed ? '준비 실패' : '준비 중'}
                      </CustomerWorkspaceSecondaryActionButton>
                    )}
                    <CustomerWorkspaceSecondaryActionButton
                      onClick={(event) => {
                        event.stopPropagation()
                        onRename(file)
                      }}
                    >
                      이름 변경
                    </CustomerWorkspaceSecondaryActionButton>
                    <CustomerWorkspaceDangerActionButton
                      onClick={(event) => {
                        event.stopPropagation()
                        onDelete(file)
                      }}
                    >
                      삭제
                    </CustomerWorkspaceDangerActionButton>
                  </CustomerWorkspaceItemActions>
                ) : (
                  <div className="storage-explorer-files__actions">
                    <button
                      type="button"
                      className={EXPLORER_FILE_ACTION_BUTTON_CLASS}
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpen(file)
                      }}
                    >
                      열기
                    </button>
                    {downloadHref ? (
                      <a
                        href={downloadHref}
                        download
                        className={EXPLORER_FILE_ACTION_BUTTON_CLASS}
                        onClick={(event) => {
                          event.stopPropagation()
                        }}
                      >
                        다운로드
                      </a>
                    ) : (
                      <button
                        type="button"
                        className={EXPLORER_FILE_ACTION_BUTTON_CLASS}
                        disabled
                        onClick={(event) => {
                          event.stopPropagation()
                        }}
                      >
                        {downloadFailed ? '준비 실패' : '준비 중'}
                      </button>
                    )}
                    <button
                      type="button"
                      className={EXPLORER_FILE_ACTION_BUTTON_CLASS}
                      onClick={(event) => {
                        event.stopPropagation()
                        onRename(file)
                      }}
                    >
                      이름 변경
                    </button>
                    <button
                      type="button"
                      className={EXPLORER_FILE_ACTION_DANGER_CLASS}
                      onClick={(event) => {
                        event.stopPropagation()
                        onDelete(file)
                      }}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
