import { useEffect, useMemo, useState } from 'react'
import { getDocument } from 'pdfjs-dist'

import { BaseDialog } from '../../../components/dialog/BaseDialog'
import FormButton from '../../../components/form/FormButton'
import FormInput from '../../../components/form/FormInput'
import { setupPdfWorker } from '../../../lib/pdfjs/setupWorker'
import {
  markStorageUploadFailed,
  presignStorageFile,
  revokeStorageStagedUpload,
  saveStorageFile,
} from '../../storage/api/storageApi'
import {
  checkDuplicateBinderMaterial,
  convertBinderImagesToPdf,
  createPersonalBinderMaterial,
} from '../personalBinder.api'
import type { PersonalBinderMaterial } from '../personalBinder.types'

setupPdfWorker()

const MAX_FILE_BYTES = 25 * 1024 * 1024
const ACCEPTED_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png'])

type UploadMode = 'separate' | 'merge'
type UploadStatus = 'ready' | 'generating' | 'uploading' | 'completed' | 'failed'
type SelectedFile = {
  id: string
  file: File
  previewUrl: string | null
  status: UploadStatus
  progress: number
  error: string
}

function withoutExtension(name: string): string {
  return name.replace(/\.(pdf|jpe?g|png)$/i, '').trim()
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_MIMES.has(file.type)) return 'PDF, JPG, JPEG, PNG 파일만 선택할 수 있습니다.'
  const extensionMatches =
    (file.type === 'application/pdf' && /\.pdf$/i.test(file.name)) ||
    (file.type === 'image/jpeg' && /\.jpe?g$/i.test(file.name)) ||
    (file.type === 'image/png' && /\.png$/i.test(file.name))
  if (!extensionMatches) return `${file.name}: 확장자와 파일 형식이 일치하지 않습니다.`
  if (file.size < 1 || file.size > MAX_FILE_BYTES) return `${file.name}: 파일은 25MB 이하여야 합니다.`
  return null
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function validatePdf(file: File): Promise<void> {
  if (file.type !== 'application/pdf') return
  const document = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  try {
    if (document.numPages < 1) throw new Error('페이지가 없는 PDF입니다.')
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
    request.setRequestHeader('Content-Type', file.type)
    Object.entries(headers).forEach(([key, value]) => request.setRequestHeader(key, value))
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve()
      : reject(new Error(`${file.name} 업로드에 실패했습니다.`))
    request.onerror = () => reject(new Error(`${file.name} 업로드에 실패했습니다.`))
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
  const [files, setFiles] = useState<SelectedFile[]>([])
  const [mode, setMode] = useState<UploadMode>('separate')
  const [mergedTitle, setMergedTitle] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const imageOnly = files.length >= 2 && files.every((entry) => entry.file.type.startsWith('image/'))
  const hasMixedTypes = files.some((entry) => entry.file.type === 'application/pdf') &&
    files.some((entry) => entry.file.type.startsWith('image/'))
  const allCompleted = files.length > 0 && files.every((entry) => entry.status === 'completed')

  useEffect(() => {
    if (!open) return
    setFiles((current) => {
      current.forEach((entry) => entry.previewUrl && URL.revokeObjectURL(entry.previewUrl))
      return []
    })
    setMode('separate')
    setMergedTitle('')
    setError('')
    setBusy(false)
  }, [open])

  const selectedSummary = useMemo(
    () => files.length > 0 ? `선택한 파일 ${files.length}개` : '파일을 드래그하거나 클릭하여 업로드',
    [files.length],
  )

  const chooseFiles = (selected: File[]) => {
    const validationError = selected.map(validateFile).find(Boolean)
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    setMode('separate')
    setFiles((current) => {
      current.forEach((entry) => entry.previewUrl && URL.revokeObjectURL(entry.previewUrl))
      return selected.map((file, index) => ({
        id: `${file.name}:${file.size}:${file.lastModified}:${index}`,
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        status: 'ready',
        progress: 0,
        error: '',
      }))
    })
    if (selected.length > 1 && selected.every((file) => file.type.startsWith('image/'))) {
      setMergedTitle(withoutExtension(selected[0]?.name ?? '상담자료'))
    }
  }

  const updateEntry = (id: string, patch: Partial<SelectedFile>) => {
    setFiles((rows) => rows.map((entry) => entry.id === id ? { ...entry, ...patch } : entry))
  }

  const uploadOne = async (
    entry: SelectedFile,
    file = entry.file,
    title = withoutExtension(file.name),
  ): Promise<PersonalBinderMaterial> => {
    if (!token) throw new Error('로그인이 필요합니다.')
    let fileId: number | null = null
    let stagedKey = ''
    try {
      await validatePdf(file)
      const checksum = await sha256(file)
      const duplicate = await checkDuplicateBinderMaterial(token, checksum)
      if (duplicate.duplicate) throw new Error(`${file.name}: 이미 등록된 자료입니다.`)
      const presign = await presignStorageFile(token, {
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      })
      fileId = presign.fileId
      stagedKey = presign.objectKey
      await uploadWithProgress(
        presign.uploadUrl,
        file,
        presign.putHeaders ?? {},
        (progress) => updateEntry(entry.id, { progress }),
      )
      const saved = await saveStorageFile(token, {
        fileId: presign.fileId,
        fileName: file.name,
        displayName: file.name,
        objectKey: presign.objectKey,
        fileUrl: presign.fileUrl,
        size: file.size,
        mimeType: file.type,
      })
      fileId = null
      stagedKey = ''
      return await createPersonalBinderMaterial(token, { fileId: saved.id, title })
    } catch (reason) {
      if (fileId != null) {
        try {
          await revokeStorageStagedUpload(token, stagedKey, { fileId })
        } catch {
          await markStorageUploadFailed(token, fileId).catch(() => undefined)
        }
      }
      throw reason
    }
  }

  const upload = async () => {
    if (!token || busy || files.length === 0) return
    setBusy(true)
    setError('')
    if (mode === 'merge') {
      const entry = files[0]
      try {
        setFiles((rows) => rows.map((row) => ({ ...row, status: 'generating', error: '' })))
        const blob = await convertBinderImagesToPdf(token, files.map((row) => row.file))
        const title = mergedTitle.trim()
        const merged = new File([blob], `${title}.pdf`, { type: 'application/pdf' })
        if (merged.size > MAX_FILE_BYTES) throw new Error('생성된 PDF가 25MB를 초과합니다.')
        setFiles((rows) => rows.map((row) => ({ ...row, status: 'uploading' })))
        const material = await uploadOne(entry, merged, title)
        setFiles((rows) => rows.map((row) => ({ ...row, status: 'completed', progress: 100 })))
        onUploaded(material)
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : 'PDF 생성 또는 업로드에 실패했습니다.'
        setFiles((rows) => rows.map((row) => ({ ...row, status: 'failed', error: message })))
        setError(message)
      } finally {
        setBusy(false)
      }
      return
    }

    for (const entry of files) {
      if (entry.status === 'completed') continue
      updateEntry(entry.id, { status: 'uploading', progress: 1, error: '' })
      try {
        const material = await uploadOne(entry)
        updateEntry(entry.id, { status: 'completed', progress: 100 })
        onUploaded(material)
      } catch (reason) {
        updateEntry(entry.id, {
          status: 'failed',
          error: reason instanceof Error ? reason.message : '업로드에 실패했습니다.',
        })
      }
    }
    setBusy(false)
  }

  const moveFile = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= files.length) return
    setFiles((rows) => {
      const next = [...rows]
      const [entry] = next.splice(index, 1)
      next.splice(target, 0, entry)
      return next
    })
  }

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      closeOnBackdrop={false}
      closeOnEsc={!busy}
      ariaLabel="자료 업로드"
    >
      <h2 className="personal-binder-dialog-title">자료 업로드</h2>
      <label
        className="personal-binder-upload-drop"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          chooseFiles(Array.from(event.dataTransfer.files ?? []))
        }}
      >
        <span>{selectedSummary}</span>
        <small>PDF, JPG, JPEG, PNG · 파일당 최대 25MB</small>
        <FormInput
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          disabled={busy}
          onChange={(event) => chooseFiles(Array.from(event.target.files ?? []))}
        />
      </label>

      {files.length > 0 ? (
        <div className="personal-binder-upload-review">
          {files.map((entry, index) => (
            <article key={entry.id} className="personal-binder-upload-file">
              {entry.previewUrl ? <img src={entry.previewUrl} alt="" /> : <span className="personal-binder-upload-file__pdf">PDF</span>}
              <div>
                <strong>{entry.file.name}</strong>
                <small>{(entry.file.size / (1024 * 1024)).toFixed(1)}MB · {entry.status}</small>
                {entry.error ? <em>{entry.error}</em> : null}
                {entry.status === 'uploading' ? <progress max={100} value={entry.progress} /> : null}
              </div>
              {mode === 'merge' ? (
                <div className="personal-binder-upload-file__order">
                  <FormButton variant="action" disabled={index === 0 || busy} onClick={() => moveFile(index, -1)}>↑</FormButton>
                  <FormButton variant="action" disabled={index === files.length - 1 || busy} onClick={() => moveFile(index, 1)}>↓</FormButton>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {files.length >= 2 ? (
        <fieldset className="personal-binder-upload-mode" disabled={busy}>
          <legend>업로드 방식</legend>
          <label>
            <FormInput type="radio" checked={mode === 'separate'} onChange={() => setMode('separate')} />
            각각 별도 자료로 업로드
          </label>
          <label>
            <FormInput
              type="radio"
              checked={mode === 'merge'}
              disabled={!imageOnly}
              onChange={() => setMode('merge')}
            />
            하나의 PDF로 묶어서 업로드
          </label>
          {hasMixedTypes ? <small>여러 이미지를 하나의 PDF로 묶으려면 이미지 파일만 선택해 주세요.</small> : null}
        </fieldset>
      ) : null}

      {mode === 'merge' ? (
        <FormInput
          value={mergedTitle}
          disabled={busy}
          onChange={(event) => setMergedTitle(event.target.value)}
          placeholder="자료 제목"
          aria-label="병합 PDF 자료 제목"
        />
      ) : null}

      {error ? <p className="personal-binder-error">{error}</p> : null}
      <div className="personal-binder-dialog-actions">
        <FormButton variant="secondary" onClick={onClose} disabled={busy}>
          {allCompleted ? '완료' : '닫기'}
        </FormButton>
        <FormButton
          variant="primary"
          onClick={() => void upload()}
          disabled={files.length === 0 || busy || (mode === 'merge' && (!imageOnly || !mergedTitle.trim()))}
          loading={busy}
          loadingText={mode === 'merge' ? 'PDF 생성 및 업로드 중…' : '업로드 중…'}
        >
          업로드
        </FormButton>
      </div>
    </BaseDialog>
  )
}
