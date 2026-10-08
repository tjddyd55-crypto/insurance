import { useEffect, useState } from 'react'
import { getDocument } from 'pdfjs-dist'

import FileUploader from '../../../components/common/FileUploader'
import { BaseDialog } from '../../../components/dialog/BaseDialog'
import FormButton from '../../../components/form/FormButton'
import FormInput from '../../../components/form/FormInput'
import {
  markStorageUploadFailed,
  presignStorageFile,
  revokeStorageStagedUpload,
  saveStorageFile,
} from '../../storage/api/storageApi'
import {
  checkDuplicateBinderMaterial,
  createPersonalBinderMaterial,
  mergePersonalBinderImagesToPdf,
} from '../personalBinder.api'
import type { PersonalBinderMaterial } from '../personalBinder.types'
import { setupPdfWorker } from '../../../lib/pdfjs/setupWorker'

setupPdfWorker()

const MAX_FILE_BYTES = 25 * 1024 * 1024
const ACCEPT =
  'application/pdf,.pdf,image/jpeg,image/png,.jpg,.jpeg,.png'

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function isImageFile(file: File): boolean {
  const type = file.type.toLowerCase()
  if (type === 'image/jpeg' || type === 'image/png') return true
  const lower = file.name.toLowerCase()
  return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png')
}

function resolveContentType(file: File): string {
  if (isPdfFile(file)) return 'application/pdf'
  if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) return 'image/png'
  return 'image/jpeg'
}

async function sha256(file: File): Promise<string> {
  const bytes = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function readPdfPageCount(file: File): Promise<number> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const document = await getDocument({ data: bytes }).promise
  try {
    return document.numPages
  } finally {
    await document.destroy()
  }
}

function uploadWithProgress(
  url: string,
  file: File,
  contentType: string,
  headers: Record<string, string>,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', url)
    request.setRequestHeader('Content-Type', contentType)
    for (const [key, value] of Object.entries(headers)) {
      request.setRequestHeader(key, value)
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve()
      else reject(new Error('파일 업로드에 실패했습니다.'))
    }
    request.onerror = () => reject(new Error('파일 업로드에 실패했습니다.'))
    request.send(file)
  })
}

async function uploadPersonalFile(
  token: string,
  file: File,
  onProgress: (value: number) => void,
): Promise<number> {
  const contentType = resolveContentType(file)
  const presign = await presignStorageFile(token, {
    fileName: file.name,
    contentType,
    sizeBytes: file.size,
  })
  let stagedKey = presign.objectKey
  let fileId: number | null = presign.fileId
  try {
    await uploadWithProgress(
      presign.uploadUrl,
      file,
      contentType,
      presign.putHeaders ?? {},
      onProgress,
    )
    const saved = await saveStorageFile(token, {
      fileId: presign.fileId,
      fileName: file.name,
      displayName: file.name,
      objectKey: presign.objectKey,
      fileUrl: presign.fileUrl,
      size: file.size,
      mimeType: contentType,
    })
    stagedKey = ''
    fileId = null
    return saved.id
  } catch (error) {
    if (fileId != null) {
      try {
        await revokeStorageStagedUpload(token, stagedKey, { fileId })
      } catch {
        try {
          await markStorageUploadFailed(token, fileId)
        } catch {
          // orphan cleanup
        }
      }
    }
    throw error
  }
}

export function MaterialUploadDialog({
  open,
  token,
  folderId = null,
  embedded = false,
  onClose,
  onUploaded,
}: {
  open: boolean
  token: string | null
  folderId?: string | null
  /** 자료 추가 모달 body 안에 표시 */
  embedded?: boolean
  onClose: () => void
  onUploaded: (material: PersonalBinderMaterial) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [imageBatch, setImageBatch] = useState<File[] | null>(null)
  const [batchOrder, setBatchOrder] = useState<File[]>([])
  const [batchTitle, setBatchTitle] = useState('')
  const [batchMode, setBatchMode] = useState<'choose' | 'merge'>('choose')

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      setFile(null)
      setTitle('')
      setProgress(0)
      setError('')
      setUploading(false)
      setImageBatch(null)
      setBatchOrder([])
      setBatchTitle('')
      setBatchMode('choose')
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  if (!open) return null

  const validateFile = (next: File): string | null => {
    const allowed = isPdfFile(next) || isImageFile(next)
    if (!allowed) return 'PDF 또는 이미지(JPG/PNG)만 업로드할 수 있습니다.'
    if (next.size < 1 || next.size > MAX_FILE_BYTES) return '파일은 25MB 이하여야 합니다.'
    return null
  }

  const acceptFiles = (files: File[]) => {
    setError('')
    const pdfs = files.filter(isPdfFile)
    const images = files.filter(isImageFile)
    if (pdfs.length > 0 && images.length > 0) {
      setFile(null)
      setError('PDF와 이미지는 함께 선택할 수 없습니다. 따로 업로드해 주세요.')
      return
    }
    if (images.length >= 2) {
      setImageBatch(images)
      setBatchOrder(images)
      const base = images[0]?.name.replace(/\.[^.]+$/, '') ?? '이미지 묶음'
      setBatchTitle(base)
      setBatchMode('choose')
      setFile(null)
      return
    }
    const next = files[0]
    if (!next) return
    setImageBatch(null)
    setFile(next)
    setTitle(next.name.replace(/\.[^.]+$/, ''))
  }

  const uploadSingle = async () => {
    if (!token?.trim() || !file || !title.trim() || uploading) return
    setUploading(true)
    setError('')
    setProgress(1)
    try {
      const contentType = resolveContentType(file)
      if (contentType === 'application/pdf') {
        const [checksum, pageCount] = await Promise.all([sha256(file), readPdfPageCount(file)])
        if (pageCount < 1) throw new Error('페이지가 없는 PDF입니다.')
        const duplicate = await checkDuplicateBinderMaterial(token, checksum)
        if (duplicate.duplicate) {
          throw new Error('이미 자료 보관함에 등록된 파일입니다.')
        }
      }
      const fileId = await uploadPersonalFile(token, file, setProgress)
      const material = await createPersonalBinderMaterial(token, {
        fileId,
        title: title.trim(),
        folderId,
      })
      setProgress(100)
      onUploaded(material)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const uploadBatchIndividually = async () => {
    if (!token?.trim() || !imageBatch?.length || uploading) return
    setUploading(true)
    setError('')
    try {
      let last: PersonalBinderMaterial | null = null
      for (let index = 0; index < batchOrder.length; index += 1) {
        const image = batchOrder[index]
        setProgress(Math.round(((index + 0.2) / batchOrder.length) * 100))
        const fileId = await uploadPersonalFile(token, image, (value) => {
          setProgress(Math.round(((index + value / 100) / batchOrder.length) * 100))
        })
        const materialTitle = image.name.replace(/\.[^.]+$/, '') || image.name
        last = await createPersonalBinderMaterial(token, {
          fileId,
          title: materialTitle,
          folderId,
        })
      }
      if (last) {
        onUploaded(last)
        onClose()
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const uploadBatchAsPdf = async () => {
    if (!token?.trim() || batchOrder.length < 2 || !batchTitle.trim() || uploading) return
    setUploading(true)
    setError('')
    setProgress(2)
    try {
      const fileIds: number[] = []
      for (let index = 0; index < batchOrder.length; index += 1) {
        const image = batchOrder[index]
        const fileId = await uploadPersonalFile(token, image, (value) => {
          const base = (index / batchOrder.length) * 70
          setProgress(Math.round(base + (value / 100) * (70 / batchOrder.length)))
        })
        fileIds.push(fileId)
      }
      setProgress(85)
      const pdfTitle = batchTitle.trim()
      const material = await mergePersonalBinderImagesToPdf(token, {
        title: pdfTitle,
        fileIds,
        folderId,
      })
      setProgress(100)
      onUploaded(material)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'PDF 생성에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const moveBatch = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= batchOrder.length || to >= batchOrder.length) {
      return
    }
    const next = [...batchOrder]
    const [entry] = next.splice(from, 1)
    next.splice(to, 0, entry)
    setBatchOrder(next)
  }

  const batchPanel =
    imageBatch && imageBatch.length >= 2 ? (
      <div className={embedded ? 'personal-binder-material-picker__upload' : undefined}>
        <h2 className="personal-binder-dialog-title">이미지 {batchOrder.length}장</h2>
        {batchMode === 'choose' ? (
          <>
            <p>각각 자료로 저장하거나, 하나의 PDF로 묶을 수 있습니다.</p>
            <div className="personal-binder-dialog-actions">
              <FormButton variant="secondary" onClick={onClose} disabled={uploading}>취소</FormButton>
              <FormButton variant="secondary" onClick={() => void uploadBatchIndividually()} loading={uploading}>
                각각 자료로 업로드
              </FormButton>
              <FormButton variant="primary" onClick={() => setBatchMode('merge')} disabled={uploading}>
                하나의 PDF로 묶기
              </FormButton>
            </div>
          </>
        ) : (
          <>
            <ul className="personal-binder-image-batch-list">
              {batchOrder.map((image, index) => (
                <li key={`${image.name}-${index}`}>
                  <span>{index + 1}. {image.name}</span>
                  <div>
                    <FormButton variant="action" size="sm" disabled={index === 0 || uploading} onClick={() => moveBatch(index, index - 1)}>↑</FormButton>
                    <FormButton variant="action" size="sm" disabled={index === batchOrder.length - 1 || uploading} onClick={() => moveBatch(index, index + 1)}>↓</FormButton>
                  </div>
                </li>
              ))}
            </ul>
            <FormInput
              value={batchTitle}
              disabled={uploading}
              onChange={(event) => setBatchTitle(event.target.value)}
              placeholder="PDF 제목"
              aria-label="PDF 제목"
            />
            {uploading ? (
              <div className="personal-binder-upload-progress">
                <span style={{ width: `${progress}%` }} />
                <strong>{progress}%</strong>
              </div>
            ) : null}
            {error ? <p className="personal-binder-error">{error}</p> : null}
            <div className="personal-binder-dialog-actions">
              <FormButton variant="secondary" onClick={() => setBatchMode('choose')} disabled={uploading}>뒤로</FormButton>
              <FormButton variant="primary" onClick={() => void uploadBatchAsPdf()} loading={uploading} disabled={!batchTitle.trim()}>
                PDF로 만들기
              </FormButton>
            </div>
          </>
        )}
      </div>
    ) : null

  if (batchPanel) {
    if (embedded) return batchPanel
    return (
      <BaseDialog
        open={open}
        onClose={onClose}
        closeOnBackdrop={false}
        closeOnEsc={!uploading}
        ariaLabel="이미지 업로드 방식"
      >
        {batchPanel}
      </BaseDialog>
    )
  }

  const uploadPanel = (
    <div className={embedded ? 'personal-binder-material-picker__upload' : undefined}>
      {embedded ? null : <h2 className="personal-binder-dialog-title">자료 업로드</h2>}
      <div className="personal-binder-upload-slot">
        <FileUploader
          accept={ACCEPT}
          multiple={true}
          disabled={uploading}
          validateFile={validateFile}
          onFiles={acceptFiles}
          onInvalidBatch={(failures) => {
            setFile(null)
            setError(failures[0]?.message ?? '지원하지 않는 파일입니다.')
          }}
          statusText={uploading ? `업로드 중… ${progress}%` : undefined}
          primaryHint={file ? file.name : '파일을 드래그하거나 클릭하여 업로드'}
          hintLines={['PDF·JPG·PNG, 파일당 최대 25MB']}
        />
      </div>
      <FormInput
        value={title}
        disabled={uploading || !file}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="자료 제목"
        aria-label="자료 제목"
      />
      {uploading ? (
        <div className="personal-binder-upload-progress">
          <span style={{ width: `${progress}%` }} />
          <strong>{progress}%</strong>
        </div>
      ) : null}
      {error ? <p className="personal-binder-error">{error}</p> : null}
      <div className="personal-binder-dialog-actions">
        <FormButton variant="secondary" onClick={onClose} disabled={uploading}>
          취소
        </FormButton>
        <FormButton
          variant="primary"
          onClick={() => void uploadSingle()}
          disabled={!file || !title.trim() || uploading}
          loading={uploading}
          loadingText="업로드 중…"
        >
          업로드
        </FormButton>
      </div>
    </div>
  )

  if (embedded) return uploadPanel

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      closeOnBackdrop={false}
      closeOnEsc={!uploading}
      ariaLabel="자료 업로드"
    >
      {uploadPanel}
    </BaseDialog>
  )
}
