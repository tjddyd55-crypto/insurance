import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  createStorageFolder,
  deleteStorageFile,
  deleteStorageFolder,
  downloadStorageFile,
  getPersonalStorageQuota,
  listStorageFiles,
  listStorageFolders,
  markStorageUploadFailed,
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
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
])
const FILE_NAME_REGEX = /^[A-Za-z0-9._\-() \u3131-\u318e\uac00-\ud7a3]+$/
const FOLDER_NAME_REGEX = /^[A-Za-z0-9 \u3131-\u318e\uac00-\ud7a3]+$/

/**
 * AbortController 로 취소된 요청에서 던져지는 AbortError 를 판별한다.
 * 브라우저마다 `DOMException` 이거나 `Error` 서브클래스인 경우가 있어 name 기준으로 판정.
 */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: string }).name === 'AbortError'
  )
}

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
  /**
   * 플랫폼 변형. 이 컴포넌트는 반드시 PC/Mobile 분기된 호출처(`ResponsiveLayout` 의
   * View 파일 또는 모바일 전용 모달) 에서만 쓰이므로 variant 를 **필수**로 받는다.
   *
   * 과거에는 컴포넌트 내부에서 `useIsMobile()` 을 호출해 화면 변형을 스스로 결정했지만
   * 이 방식은 "누가 무슨 UI 를 보는지" 를 컴포넌트 사용자가 제어할 수 없게 만들었다.
   * AGENTS.md §8-5 Tier 4 "prop 승격" 규칙에 맞춰 호출처에서 명시한다.
   */
  variant: 'pc' | 'mobile'
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
  if (lower.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
  if (lower.endsWith('.xls')) {
    return 'application/vnd.ms-excel'
  }
  if (lower.endsWith('.csv')) {
    return 'text/csv'
  }
  return file.type || 'application/octet-stream'
}

function formatStorageMb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0'
  }
  return (bytes / (1024 * 1024)).toFixed(1)
}

function calculateStoragePercent(usedBytes: number, limitBytes: number): number {
  const total = Number.isFinite(limitBytes) && limitBytes > 0 ? limitBytes : 0
  const used = Number.isFinite(usedBytes) && usedBytes > 0 ? usedBytes : 0
  if (total <= 0) {
    return 0
  }
  return (used / total) * 100
}

export default function StorageWorkspace({
  token,
  customerId = null,
  title,
  subtitle,
  headerSlot,
  variant,
}: StorageWorkspaceProps) {
  const isMobile = variant === 'mobile'
  const [folders, setFolders] = useState<StorageFolderRow[]>([])
  const [files, setFiles] = useState<StorageFileRow[]>([])
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(new Set())
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
  const [quota, setQuota] = useState<{
    usedBytes: number
    limitBytes: number
    pendingUploadBytes?: number
  } | null>(null)
  const [quotaLoading, setQuotaLoading] = useState(true)

  const folderOptions = useMemo(
    () => [{ id: null, name: '전체', createdAt: '' } as const, ...folders],
    [folders],
  )

  const storageFolderScope = useMemo(
    () => (customerId != null ? { customerId } : undefined),
    [customerId],
  )

  useEffect(() => {
    if (!token?.trim()) {
      return
    }
    setFolders([])
    setFiles([])
    setSelectedFolderId(null)
    setSelectedFileId(null)
    setError('')
  }, [customerId, token])

  useEffect(() => {
    setExpandedFolderIds((prev) => {
      const next = new Set<number>()
      for (const folder of folders) {
        // 새로 생긴 폴더는 기본 펼침으로 시작, 기존 폴더는 사용자의 이전 상태를 유지.
        if (prev.has(folder.id) || !prev.size) {
          next.add(folder.id)
        }
      }
      return next
    })
  }, [folders])

  /**
   * 각 로드 함수는 **외부 입력(token, customerId, selectedFolderId)** 에만 의존한다.
   * 과거에는 `loadFolders` 가 deps 에 `selectedFolderId` 를 포함하면서 함수 **내부에서**
   * `setSelectedFolderId(null)` 을 호출해 "자기 deps 를 자기가 바꾸는" 안티패턴이었고,
   * 이것이 연쇄적으로 `refreshAll` → `useEffect` → fetch 폭주(동일 리소스 2~N중 호출,
   * Chrome 의 동시 6연결 한도 초과로 대부분 pending stall) 를 유발했다.
   *
   * 해결 원칙:
   *   1) fetch 함수는 "가져오기" 만 담당. 선택 상태 정리(cleanup)는 별도 effect 로.
   *   2) 자동 로드 effect 는 리소스별 1개씩 → folders / files / quota 세 개.
   *   3) `refreshAll` 은 사용자 행동(업로드, 삭제, rename) 뒤의 **수동 트리거 전용**.
   */
  const loadFolders = useCallback(
    async (signal?: AbortSignal) => {
      if (!token?.trim()) {
        setFolders([])
        return
      }
      const rows = await listStorageFolders(token, storageFolderScope, { signal })
      setFolders(rows)
    },
    [storageFolderScope, token],
  )

  const loadQuota = useCallback(
    async (signal?: AbortSignal) => {
      if (!token?.trim()) {
        setQuota(null)
        setQuotaLoading(false)
        return
      }
      setQuotaLoading(true)
      try {
        const q = await getPersonalStorageQuota(token, { signal })
        setQuota(q)
      } catch (e) {
        if (isAbortError(e)) {
          return
        }
        setQuota(null)
      } finally {
        setQuotaLoading(false)
      }
    },
    [token],
  )

  const loadFiles = useCallback(
    async (signal?: AbortSignal) => {
      if (!token?.trim()) {
        setFiles([])
        return
      }
      const rows = await listStorageFiles(
        token,
        { customerId },
        { signal },
      )
      setFiles(rows)
    },
    [customerId, token],
  )

  /**
   * 각 자동 로드 effect 에 AbortController 를 연결해 컴포넌트 언마운트·deps 변경 시
   * 진행 중이던 요청을 취소한다. 효과:
   *   - React StrictMode 의 dev-only double invoke 에서 첫 번째 호출이 즉시 취소되어
   *     네트워크 슬롯(HTTP/1.1 동시 6 연결) 을 점유하지 않는다.
   *   - 고객 A→B 전환 시 A 의 folders/files 요청이 즉시 취소되어 B 의 요청이 바로 출발.
   *   - pending 잔여 요청이 다음 화면까지 쌓이지 않아 stall 연쇄가 끊어진다.
   *
   * AbortError 는 정상적인 취소이므로 사용자용 에러 메시지를 띄우지 않는다.
   */
  useEffect(() => {
    if (!token?.trim()) {
      return
    }
    const controller = new AbortController()
    void loadQuota(controller.signal)
    return () => controller.abort()
  }, [loadQuota, token])

  useEffect(() => {
    if (!token?.trim()) {
      return
    }
    const controller = new AbortController()
    void loadFolders(controller.signal).catch((e) => {
      if (isAbortError(e)) {
        return
      }
      setError(e instanceof Error ? e.message : '폴더 목록을 불러오지 못했습니다.')
    })
    return () => controller.abort()
  }, [loadFolders, token])

  useEffect(() => {
    if (!token?.trim()) {
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void loadFiles(controller.signal)
      .catch((e) => {
        if (isAbortError(e)) {
          return
        }
        setError(e instanceof Error ? e.message : '파일 목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [loadFiles, token])

  /**
   * 선택 cleanup 은 로드와 독립 effect 로 분리.
   * 과거에는 loadFolders/loadFiles 내부에서 setSelectedXxx 를 호출했고, 해당 state 가
   * 그 함수의 deps 라서 useCallback 이 재생성 → useEffect 재실행 → fetch 가 또 돌았다.
   * 이제는 목록(folders/files) 변화에만 반응해 존재하지 않는 선택 id 를 비운다.
   */
  useEffect(() => {
    if (selectedFolderId != null && !folders.some((folder) => folder.id === selectedFolderId)) {
      setSelectedFolderId(null)
    }
  }, [folders, selectedFolderId])

  useEffect(() => {
    if (selectedFileId != null && !files.some((file) => file.id === selectedFileId)) {
      setSelectedFileId(null)
    }
  }, [files, selectedFileId])

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
      await createStorageFolder(token, name, storageFolderScope)
      setCreateFolderOpen(false)
      setCreateFolderName('')
      await loadFolders()
    } catch (e) {
      setError(e instanceof Error ? e.message : '폴더 생성에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }, [createFolderName, loadFolders, storageFolderScope, submitting, token])

  const validateStoragePickerFile = useCallback((file: File): string | null => {
    const normalizedName = normalizeName(file.name, FILE_NAME_MAX_LENGTH)
    const mimeType = guessContentType(file)
    if (!isValidFileName(normalizedName)) {
      return '파일 이름 형식이 올바르지 않습니다.'
    }
    if (!ALLOWED_MIME.has(mimeType)) {
      return 'JPG, PNG, PDF, XLS, XLSX, CSV만 업로드할 수 있습니다.'
    }
    if (file.size < 1) {
      return '빈 파일은 업로드할 수 없습니다.'
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return '파일 크기는 25MB 이하여야 합니다.'
    }
    return null
  }, [])

  const uploadFiles = useCallback(
    async (selectedFiles: File[] | FileList | null) => {
      if (!token?.trim() || uploading || !selectedFiles?.length) {
        return
      }
      setUploading(true)
      setError('')
      const uploads = Array.isArray(selectedFiles) ? selectedFiles : Array.from(selectedFiles)
      let failCount = 0
      for (const file of uploads) {
        const normalizedName = normalizeName(file.name, FILE_NAME_MAX_LENGTH)
        const mimeType = guessContentType(file)
        if (!isValidFileName(normalizedName) || !ALLOWED_MIME.has(mimeType) || file.size < 1 || file.size > MAX_UPLOAD_BYTES) {
          failCount += 1
          continue
        }
        let stagedObjectKey: string | null = null
        let uploadFileId: number | null = null
        try {
          const presign = await presignStorageFile(token, {
            fileName: normalizedName,
            contentType: mimeType,
            sizeBytes: file.size,
            customerId,
          })
          uploadFileId = presign.fileId
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
            fileId: presign.fileId,
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
          uploadFileId = null
        } catch {
          failCount += 1
          if (uploadFileId != null) {
            try {
              await revokeStorageStagedUpload(token, stagedObjectKey ?? '', {
                customerId,
                fileId: uploadFileId,
              })
            } catch {
              try {
                await markStorageUploadFailed(token, uploadFileId)
              } catch {
                /* orphan cron */
              }
            }
          }
        }
      }
      await Promise.all([loadFiles(), loadQuota()])
      setUploading(false)
      if (failCount > 0) {
        setError(`${failCount}개 파일 업로드에 실패했습니다.`)
      }
    },
    [customerId, loadFiles, loadQuota, selectedFolderId, token, uploading],
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
        await renameStorageFolder(token, renameTarget.folder.id, value)
        await loadFolders()
      }
      setRenameTarget(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '이름 변경에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }, [loadFolders, renameTarget, submitting, token])

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
        await loadQuota()
      } else {
        await deleteStorageFolder(token, deleteTarget.folder.id)
        if (selectedFolderId === deleteTarget.folder.id) {
          setSelectedFolderId(null)
        }
        await loadFolders()
      }
      setDeleteTarget(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }, [deleteTarget, loadFolders, loadQuota, selectedFolderId, submitting, token])

  const downloadFile = useCallback(
    async (file: StorageFileRow) => {
      if (!token?.trim()) {
        return
      }
      try {
        await downloadStorageFile(token, file.id)
      } catch (e) {
        setError(e instanceof Error ? e.message : '다운로드에 실패했습니다.')
      }
    },
    [token],
  )

  const quotaPercent = useMemo(() => {
    if (!quota) {
      return null
    }
    const percent = calculateStoragePercent(quota.usedBytes, quota.limitBytes)
    const safePercent = Math.min(Math.max(percent, 0), 100)
    return {
      text: percent.toFixed(1),
      safe: safePercent,
    }
  }, [quota])

  return (
    <div className="storage-workspace page-shell">
      {headerSlot}
      <div className="storage-workspace__header">
        {title?.trim() ? <h1 className="storage-workspace__title">{title}</h1> : null}
        {subtitle ? <p className="storage-workspace__subtitle">{subtitle}</p> : null}
        <p className="storage-workspace__quota" role="status">
          {quotaLoading ? (
            <>개인 저장공간 사용량 불러오는 중…</>
          ) : quota ? (
            <>
              개인 저장소 사용량 {formatStorageMb(quota.usedBytes)} MB / {formatStorageMb(quota.limitBytes)} MB (
              {quotaPercent?.text ?? '0.0'}%)
              {quota.pendingUploadBytes != null && quota.pendingUploadBytes > 0
                ? ` (업로드 진행 예약 ${formatStorageMb(quota.pendingUploadBytes)} MB)`
                : ''}
              {customerId != null ? ' (고객 파일·내 저장공간 합산)' : ''}
              <span className="storage-bar" aria-hidden="true">
                <span className="storage-bar-fill" style={{ width: `${quotaPercent?.safe ?? 0}%` }} />
              </span>
            </>
          ) : (
            <>개인 저장공간 용량 정보를 불러오지 못했습니다.</>
          )}
        </p>
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
        validateUploadFile={validateStoragePickerFile}
        onUploadFiles={(selectedFiles) => {
          void uploadFiles(selectedFiles)
        }}
        onUploadInvalidBatch={(failures) => {
          if (failures.length) {
            setError(`${failures.length}개 파일이 형식·용량·이름 규칙에 맞지 않습니다.`)
          }
        }}
        uploading={uploading}
      />

      {error ? <p className="storage-workspace__error">{error}</p> : null}

      <StorageFileList
        folders={folders}
        files={files}
        loading={loading}
        selectedFileId={selectedFileId}
        expandedFolderIds={expandedFolderIds}
        onToggleFolder={(folderId) => {
          setExpandedFolderIds((prev) => {
            const next = new Set(prev)
            if (next.has(folderId)) {
              next.delete(folderId)
            } else {
              next.add(folderId)
            }
            return next
          })
        }}
        onSelectFile={setSelectedFileId}
        onDownload={(file) => {
          void downloadFile(file)
        }}
        onRename={openRenameFileDialog}
        onDelete={(file) => setDeleteTarget({ kind: 'file', file })}
        onRenameFolder={openRenameFolderDialog}
        onDeleteFolder={(folder) => setDeleteTarget({ kind: 'folder', folder })}
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
