import { useEffect, useState } from 'react'
import { getDocument } from 'pdfjs-dist'

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
} from '../personalBinder.api'
import type { PersonalBinderMaterial } from '../personalBinder.types'
import { setupPdfWorker } from '../../../lib/pdfjs/setupWorker'

setupPdfWorker()

const MAX_PDF_BYTES = 25 * 1024 * 1024

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
  headers: Record<string, string>,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', url)
    request.setRequestHeader('Content-Type', 'application/pdf')
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
      else reject(new Error('PDF 업로드에 실패했습니다.'))
    }
    request.onerror = () => reject(new Error('PDF 업로드에 실패했습니다.'))
    request.send(file)
  })
}

export function MaterialUploadDialog({
  open,
  token,
  onClose,
  onUploaded,
}: {
  open: boolean
  token: string | null
  onClose: () => void
  onUploaded: (material: PersonalBinderMaterial) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      setFile(null)
      setTitle('')
      setProgress(0)
      setError('')
      setUploading(false)
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  if (!open) return null

  const chooseFile = (next: File | null) => {
    setError('')
    if (!next) {
      setFile(null)
      return
    }
    if (
      next.type !== 'application/pdf' ||
      !next.name.toLowerCase().endsWith('.pdf')
    ) {
      setError('PDF 파일만 업로드할 수 있습니다.')
      return
    }
    if (next.size < 1 || next.size > MAX_PDF_BYTES) {
      setError('PDF 파일은 25MB 이하여야 합니다.')
      return
    }
    setFile(next)
    setTitle(next.name.replace(/\.pdf$/i, ''))
  }

  const upload = async () => {
    if (!token?.trim() || !file || !title.trim() || uploading) return
    setUploading(true)
    setError('')
    setProgress(1)
    let stagedKey = ''
    let fileId: number | null = null
    try {
      const [checksum, pageCount] = await Promise.all([
        sha256(file),
        readPdfPageCount(file),
      ])
      if (pageCount < 1) throw new Error('페이지가 없는 PDF입니다.')
      const duplicate = await checkDuplicateBinderMaterial(token, checksum)
      if (duplicate.duplicate) {
        throw new Error('이미 자료 보관함에 등록된 PDF입니다.')
      }
      const presign = await presignStorageFile(token, {
        fileName: file.name,
        contentType: 'application/pdf',
        sizeBytes: file.size,
      })
      stagedKey = presign.objectKey
      fileId = presign.fileId
      await uploadWithProgress(
        presign.uploadUrl,
        file,
        presign.putHeaders ?? {},
        setProgress,
      )
      const saved = await saveStorageFile(token, {
        fileId: presign.fileId,
        fileName: file.name,
        displayName: file.name,
        objectKey: presign.objectKey,
        fileUrl: presign.fileUrl,
        size: file.size,
        mimeType: 'application/pdf',
      })
      stagedKey = ''
      fileId = null
      const material = await createPersonalBinderMaterial(token, {
        fileId: saved.id,
        title: title.trim(),
      })
      setProgress(100)
      onUploaded(material)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '업로드에 실패했습니다.')
      if (fileId != null) {
        try {
          await revokeStorageStagedUpload(token, stagedKey, { fileId })
        } catch {
          try {
            await markStorageUploadFailed(token, fileId)
          } catch {
            // 기존 orphan cleanup cron이 실패 행을 정리한다.
          }
        }
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      closeOnBackdrop={false}
      closeOnEsc={!uploading}
      ariaLabel="PDF 자료 업로드"
    >
      <h2 className="personal-binder-dialog-title">PDF 자료 업로드</h2>
      <label
        className="personal-binder-upload-drop"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          chooseFile(event.dataTransfer.files?.[0] ?? null)
        }}
      >
        <span>{file ? file.name : 'PDF를 선택하거나 여기에 놓으세요'}</span>
        <FormInput
          type="file"
          accept="application/pdf,.pdf"
          disabled={uploading}
          onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <FormInput
        value={title}
        disabled={uploading}
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
          onClick={() => void upload()}
          disabled={!file || !title.trim() || uploading}
          loading={uploading}
          loadingText="업로드 중…"
        >
          업로드
        </FormButton>
      </div>
    </BaseDialog>
  )
}
