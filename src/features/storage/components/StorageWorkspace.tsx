import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { FormButton } from '../../../components/form'
import { useMediaQuery } from '../../../hooks/useMediaQuery'
import {
  createStorageFolder,
  deleteStorageFile,
  deleteStorageFolder,
  getStorageFileDownloadUrl,
  listStorageFiles,
  listStorageFolders,
  presignStorageFile,
  renameStorageFile,
  renameStorageFolder,
  revokeStorageStagedUpload,
  saveStorageFile,
  type StorageFileRow,
  type StorageFolderRow,
} from '../api/storageApi'
import StorageDeleteDialog from './StorageDeleteDialog'
import StorageFileList from './StorageFileList'
import StorageRenameDialog from './StorageRenameDialog'
import StorageToolbar from './StorageToolbar'

const FILE_NAME_MAX_LENGTH = 120
const FOLDER_NAME_MAX_LENGTH = 12
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const FILE_NAME_REGEX = /^[A-Za-z0-9._\-() \u3131-\u318e\uac00-\ud7a3]+$/
const FOLDER_NAME_REGEX = /^[A-Za-z0-9 \u3131-\u318e\uac00-\ud7a3]+$/

type RenameTarget =
  | { kind: 'file'; file: StorageFileRow; value: string }
  | { kind: 'folder'; folder: StorageFolderRow; value: string }

type DeleteTarget =
  | { kind: 'file'; file: StorageFileRow }
  | { kind: 'folder'; folder: StorageFolderRow }

type StorageWorkspaceProps = {
  token: string | null
  customerId?: number | null
  title: string
  subtitle?: string
  headerSlot?: ReactNode
}

function normalizeName(raw: string, maxLength: number): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function isValidFileName(raw: string): boolean {
  const value = normalizeName(raw, FILE_NAME_MAX_LENGTH)
  return Boolean(value) && FILE_NAME_REGEX.test(value)
}

function isValidFolderName(raw: string): boolean {
  const value = normalizeName(raw, FOLDER_NAME_MAX_LENGTH)
  return Boolean(value) && FOLDER_NAME_REGEX.test(value)
}

function guessContentType(file: File): string {
  if (file.type && ALLOWED_MIME.has(file.type)) {
    return file.type
  }
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.pdf')) {
    return 'application/pdf'
  }
  if (lower.endsWith('.png')) {
    return 'image/png'
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg'
  }
  return file.type || 'application/octet-stream'
}

export default function StorageWorkspace({
  token,
  customerId = null,
  title,
  subtitle,
  headerSlot,
}: StorageWorkspaceProps) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [folders, setFolders] = useState<StorageFolderRow[]>([])
  const [files, setFiles] = useState<StorageFileRow[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [folderPickerOpen, setFolderPickerOpen] = useState(false)

  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [createFolderName, setCreateFolderName] = useState('')
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  const folderOptions = useMemo(
    () => [{ id: null, name: '전체', createdAt: '' } as const, ...folders],
    [folders],
  )

  const loadFolders = useCallback(async () => {
    if (!token?.trim()) {
      setFolders([])
      return
    }
    const rows = await listStorageFolders(token)
    setFolders(rows)
    if (selectedFolderId != null && !rows.some((folder) => folder.id === selectedFolderId)) {
      setSelectedFolderId(null)
    }
  }, [selectedFolderId, token])

  const loadFiles = useCallback(async () => {
    if (!token?.trim()) {
      setFiles([])
      return
    }
    const rows = await listStorageFiles(token, {
      customerId,
      folderId: selectedFolderId,
    })
    setFiles(rows)
    if (selectedFileId != null && !rows.some((file) => file.id === selectedFileId)) {
      setSelectedFileId(null)
    }
  }, [customerId, selectedFileId, selectedFolderId, token])

  const refreshAll = useCallback(async () => {
    if (!token?.trim()) {
      return
    }
    setLoading(true)
    setError('')
    try {
      await Promise.all([loadFolders(), loadFiles()])
    } catch (e) {
      setError(e instanceof Error ? e.message : '스토리지 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [loadFiles, loadFolders, token])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  useEffect(() => {
    if (!token?.trim()) {
      return
    }
    setLoading(true)
    setError('')
    void loadFiles()
      .catch((e) => {
        setError(e instanceof Error ? e.message : '파일 목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [loadFiles, token])

  const openCreateFolderDialog = useCallback(() => {
    setCreateFolderName('')
    setCreateFolderOpen(true)
  }, [])

  const submitCreateFolder = useCallback(async () => {
    if (!token?.trim() || submitting) {
      return
    }
    const name = normalizeName(createFolderName, FOLDER_NAME_MAX_LENGTH)
    if (!isValidFolderName(name) || name === '전체') {
      setError('폴더 이름은 12자 이내(특수문자 제외)로 입력해 주세요.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const created = await createStorageFolder(token, name)
      setFolders((prev) => [created, ...prev])
      setCreateFolderOpen(false)
      setCreateFolderName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '폴더 생성에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }, [createFolderName, submitting, token])

  const uploadFiles = useCallback(
    async (selectedFiles: FileList | null) => {
      if (!token?.trim() || uploading || !selectedFiles?.length) {
        return
      }
      setUploading(true)
      setError('')
      const uploads = Array.from(selectedFiles)
      let failCount = 0
      for (const file of uploads) {
        const normalizedName = normalizeName(file.name, FILE_NAME_MAX_LENGTH)
        const mimeType = guessContentType(file)
        if (!isValidFileName(normalizedName) || !ALLOWED_MIME.has(mimeType) || file.size < 1 || file.size > MAX_UPLOAD_BYTES) {
          failCount += 1
          continue
        }
        let stagedObjectKey: string | null = null
        try {
          const presign = await presignStorageFile(token, {
            fileName: normalizedName,
            contentType: mimeType,
            sizeBytes: file.size,
            customerId,
          })
          stagedObjectKey = presign.objectKey
          const put = await fetch(presign.uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': mimeType,
              ...(presign.putHeaders ?? {}),
            },
            body: file,
          })
          if (!put.ok) {
            throw new Error('업로드 실패')
          }
          await saveStorageFile(token, {
            fileName: normalizedName,
            displayName: normalizedName,
            objectKey: presign.objectKey,
            fileUrl: presign.fileUrl,
            size: file.size,
            mimeType,
            folderId: selectedFolderId,
            customerId,
          })
          stagedObjectKey = null
        } catch {
          failCount += 1
          if (stagedObjectKey) {
            try {
              await revokeStorageStagedUpload(token, stagedObjectKey, { customerId })
            } catch {
              // orphan cleanup best-effort
            }
          }
        }
      }
      await loadFiles()
      setUploading(false)
      if (failCount > 0) {
        setError(`${failCount}개 파일 업로드에 실패했습니다.`)
      }
    },
    [customerId, loadFiles, selectedFolderId, token, uploading],
  )

  const openRenameFileDialog = useCallback((file: StorageFileRow) => {
    setRenameTarget({ kind: 'file', file, value: file.displayName })
  }, [])

  const openRenameFolderDialog = useCallback((folder: StorageFolderRow) => {
    setRenameTarget({ kind: 'folder', folder, value: folder.name })
  }, [])

  const submitRename = useCallback(async () => {
    if (!token?.trim() || !renameTarget || submitting) {
      return
    }
    const value =
      renameTarget.kind === 'file'
        ? normalizeName(renameTarget.value, FILE_NAME_MAX_LENGTH)
        : normalizeName(renameTarget.value, FOLDER_NAME_MAX_LENGTH)

    const valid = renameTarget.kind === 'file' ? isValidFileName(value) : isValidFolderName(value)
    if (!valid || value === '전체') {
      setError('이름 형식이 올바르지 않습니다.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      if (renameTarget.kind === 'file') {
        const updated = await renameStorageFile(token, renameTarget.file.id, value)
        setFiles((prev) => prev.map((file) => (file.id === updated.id ? updated : file)))
      } else {
        const updated = await renameStorageFolder(token, renameTarget.folder.id, value)
        setFolders((prev) => prev.map((folder) => (folder.id === updated.id ? updated : folder)))
      }
      setRenameTarget(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '이름 변경에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }, [renameTarget, submitting, token])

  const submitDelete = useCallback(async () => {
    if (!token?.trim() || !deleteTarget || submitting) {
      return
    }
    setSubmitting(true)
    setError('')
    try {
      if (deleteTarget.kind === 'file') {
        await deleteStorageFile(token, deleteTarget.file.id)
        setFiles((prev) => prev.filter((file) => file.id !== deleteTarget.file.id))
      } else {
        await deleteStorageFolder(token, deleteTarget.folder.id)
        setFolders((prev) => prev.filter((folder) => folder.id !== deleteTarget.folder.id))
        if (selectedFolderId === deleteTarget.folder.id) {
          setSelectedFolderId(null)
        }
      }
      setDeleteTarget(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }, [deleteTarget, selectedFolderId, submitting, token])

  const downloadFile = useCallback(
    async (file: StorageFileRow) => {
      if (!token?.trim()) {
        return
      }
      try {
        const result = await getStorageFileDownloadUrl(token, file.id)
        window.open(result.url, '_blank', 'noopener,noreferrer')
      } catch (e) {
        setError(e instanceof Error ? e.message : '다운로드 링크를 가져오지 못했습니다.')
      }
    },
    [token],
  )

  return (
    <div className="storage-workspace page-shell">
      {headerSlot}
      <div className="storage-workspace__header">
        <h1 className="storage-workspace__title">{title}</h1>
        {subtitle ? <p className="storage-workspace__subtitle">{subtitle}</p> : null}
      </div>

      <StorageToolbar
        isMobile={isMobile}
        folderOptions={folderOptions}
        selectedFolderId={selectedFolderId}
        folderPickerOpen={folderPickerOpen}
        onOpenFolderPicker={() => setFolderPickerOpen(true)}
        onCloseFolderPicker={() => setFolderPickerOpen(false)}
        onSelectFolder={(folderId) => setSelectedFolderId(folderId)}
        onOpenCreateFolder={openCreateFolderDialog}
        onUploadFiles={(selectedFiles) => {
          void uploadFiles(selectedFiles)
        }}
        uploading={uploading}
      />

      <div className="storage-folders">
        {folderOptions.map((folder) => {
          const selected = folder.id === selectedFolderId
          const editable = folder.id != null
          return (
            <div key={folder.id == null ? 'all' : String(folder.id)} className={`storage-folders__chip${selected ? ' storage-folders__chip--selected' : ''}`}>
              <FormButton htmlType="button" variant="action" onClick={() => setSelectedFolderId(folder.id)}>
                {folder.name}
              </FormButton>
              {editable ? (
                <div className="storage-folders__actions">
                  <FormButton htmlType="button" variant="action" onClick={() => openRenameFolderDialog(folder)}>
                    ✏️
                  </FormButton>
                  <FormButton htmlType="button" variant="action" onClick={() => setDeleteTarget({ kind: 'folder', folder })}>
                    🗑️
                  </FormButton>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {error ? <p className="storage-workspace__error">{error}</p> : null}

      <StorageFileList
        files={files}
        loading={loading}
        selectedFileId={selectedFileId}
        onSelectFile={setSelectedFileId}
        onDownload={(file) => {
          void downloadFile(file)
        }}
        onRename={openRenameFileDialog}
        onDelete={(file) => setDeleteTarget({ kind: 'file', file })}
      />

      <StorageRenameDialog
        open={createFolderOpen}
        title="폴더 생성"
        value={createFolderName}
        loading={submitting}
        onChange={setCreateFolderName}
        onClose={() => setCreateFolderOpen(false)}
        onSubmit={() => {
          void submitCreateFolder()
        }}
      />

      <StorageRenameDialog
        open={renameTarget != null}
        title={renameTarget?.kind === 'file' ? '파일 이름 변경' : '폴더 이름 변경'}
        value={renameTarget?.value ?? ''}
        loading={submitting}
        onChange={(value) => {
          setRenameTarget((prev) => (prev ? { ...prev, value } : prev))
        }}
        onClose={() => setRenameTarget(null)}
        onSubmit={() => {
          void submitRename()
        }}
      />

      <StorageDeleteDialog
        open={deleteTarget != null}
        title={deleteTarget?.kind === 'file' ? '파일 삭제' : '폴더 삭제'}
        description={
          deleteTarget?.kind === 'file'
            ? `"${deleteTarget.file.displayName}" 파일을 삭제합니다.`
            : `"${deleteTarget?.folder.name}" 폴더를 삭제합니다.`
        }
        loading={submitting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          void submitDelete()
        }}
      />
    </div>
  )
}
