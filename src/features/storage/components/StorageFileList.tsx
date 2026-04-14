import { FormButton } from '../../../components/form'
import type { StorageFileRow } from '../api/storageApi'

type StorageFileListProps = {
  files: StorageFileRow[]
  loading: boolean
  selectedFileId: number | null
  onSelectFile: (id: number) => void
  onDownload: (file: StorageFileRow) => void
  onRename: (file: StorageFileRow) => void
  onDelete: (file: StorageFileRow) => void
}

function renderFileIcon(file: StorageFileRow): string {
  const mime = String(file.mimeType ?? '').toLowerCase()
  if (mime === 'application/pdf') {
    return '📄'
  }
  if (mime.startsWith('image/')) {
    return '🖼️'
  }
  return '📁'
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleString('ko-KR')
}

export default function StorageFileList({
  files,
  loading,
  selectedFileId,
  onSelectFile,
  onDownload,
  onRename,
  onDelete,
}: StorageFileListProps) {
  if (loading) {
    return <p className="storage-file-list__empty">불러오는 중…</p>
  }
  if (files.length === 0) {
    return <p className="storage-file-list__empty">파일이 없습니다.</p>
  }
  return (
    <div className="storage-file-list">
      {files.map((file) => {
        const selected = selectedFileId === file.id
        return (
          <div
            key={file.id}
            className={`storage-file-list__item${selected ? ' storage-file-list__item--selected' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelectFile(file.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelectFile(file.id)
              }
            }}
          >
            <div className="storage-file-list__main">
              <span className="storage-file-list__icon">{renderFileIcon(file)}</span>
              <div className="storage-file-list__meta">
                <div className="storage-file-list__name">{file.displayName}</div>
                <div className="storage-file-list__sub">{formatDate(file.createdAt)}</div>
              </div>
            </div>
            <div className="storage-file-list__actions">
              <FormButton htmlType="button" variant="action" onClick={() => onDownload(file)}>
                다운로드
              </FormButton>
              <FormButton htmlType="button" variant="action" onClick={() => onRename(file)}>
                이름 변경
              </FormButton>
              <FormButton htmlType="button" variant="action" onClick={() => onDelete(file)}>
                삭제
              </FormButton>
            </div>
          </div>
        )
      })}
    </div>
  )
}
