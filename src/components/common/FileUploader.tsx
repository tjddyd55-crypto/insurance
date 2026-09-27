import { useCallback, useRef, useState } from 'react'
import FormInput from '../form/FormInput'

export type FileUploaderProps = {
  /** input accept 속성 */
  accept: string
  /** 파일별 검증. null 이면 통과, 문자열이면 거절 사유. 생략하면 모두 통과. */
  validateFile?: (file: File) => string | null
  /** 검증을 통과한 파일만 전달 */
  onFiles: (files: File[]) => void
  /** 검증 실패 항목 (업로드 루프 전 단계) */
  onInvalidBatch?: (failures: { file: File; message: string }[]) => void
  multiple?: boolean
  disabled?: boolean
  /** 좁은 툴바 등에 맞춘 높이 */
  compact?: boolean
  /** 예: 업로드 중 문구 */
  statusText?: string
  primaryHint?: string
  hintLines?: string[]
  /** 선택한 파일명. 없으면 줄을 그리지 않아 기존 호출부는 그대로다. */
  selectedNames?: readonly string[]
}

const DEFAULT_HINT = '파일을 드래그하거나 클릭하여 선택하세요.'
const acceptEveryFile = () => null

export default function FileUploader({
  accept,
  validateFile = acceptEveryFile,
  onFiles,
  onInvalidBatch,
  multiple = true,
  disabled = false,
  compact = false,
  statusText,
  primaryHint = DEFAULT_HINT,
  hintLines,
  selectedNames,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const processList = useCallback(
    (list: FileList | File[] | null | undefined) => {
      if (disabled || !list?.length) {
        return
      }
      const arr = Array.from(list)
      const valid: File[] = []
      const failures: { file: File; message: string }[] = []
      for (const file of arr) {
        const msg = validateFile(file)
        if (msg) {
          failures.push({ file, message: msg })
        } else {
          valid.push(file)
        }
      }
      if (failures.length) {
        onInvalidBatch?.(failures)
      }
      if (valid.length) {
        onFiles(valid)
      }
    },
    [disabled, onFiles, onInvalidBatch, validateFile],
  )

  const openPicker = useCallback(() => {
    if (disabled) {
      return
    }
    inputRef.current?.click()
  }, [disabled])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      processList(e.dataTransfer.files)
    },
    [processList],
  )

  const busy = Boolean(statusText)
  const names = selectedNames?.map((name) => name.trim()).filter(Boolean) ?? []

  return (
    <div
      role="button"
      tabIndex={0}
      className={`file-uploader${dragOver ? ' file-uploader--active' : ''}${compact ? ' file-uploader--compact' : ''}${busy ? ' file-uploader--busy' : ''}`}
      onClick={(event) => {
        event.stopPropagation()
        openPicker()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openPicker()
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        if (!disabled) {
          setDragOver(true)
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) {
          setDragOver(true)
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      aria-disabled={disabled}
      aria-busy={busy}
    >
      <FormInput
        ref={inputRef}
        type="file"
        accept={accept.trim() ? accept : undefined}
        multiple={multiple}
        hidden
        disabled={disabled}
        onChange={(e) => {
          processList(e.target.files)
          e.target.value = ''
        }}
      />
      {statusText ? (
        <p className="file-uploader__status">{statusText}</p>
      ) : (
        <>
          <p className="file-uploader__primary">{primaryHint}</p>
          {hintLines?.length
            ? hintLines.map((line) => (
                <p key={line} className="file-uploader__muted">
                  {line}
                </p>
              ))
            : null}
          {names.length > 0 ? <p className="file-uploader__muted">{names.join(', ')}</p> : null}
        </>
      )}
    </div>
  )
}
