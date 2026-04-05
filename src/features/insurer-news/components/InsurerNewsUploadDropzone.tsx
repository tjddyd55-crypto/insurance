import { useCallback, useRef, useState } from 'react'

type Props = {
  onFiles: (files: FileList | File[]) => void
  disabled?: boolean
}

export function InsurerNewsUploadDropzone({ onFiles, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

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
      if (disabled || !e.dataTransfer.files?.length) {
        return
      }
      onFiles(e.dataTransfer.files)
    },
    [disabled, onFiles],
  )

  return (
    <div
      role="button"
      tabIndex={0}
      className={`insurer-news-dropzone${dragOver ? ' insurer-news-dropzone--active' : ''}`}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openPicker()
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      aria-disabled={disabled}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        multiple
        hidden
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files?.length) {
            onFiles(e.target.files)
          }
          e.target.value = ''
        }}
      />
      <p className="insurer-news-dropzone__hint">
        이미지 또는 PDF를 드래그하여 놓거나, 탭하여 선택하세요.
      </p>
      <p className="insurer-news-muted" style={{ fontSize: 12, marginTop: 8 }}>
        PDF 업로드 시 이미지로 변환됩니다 (최대 20페이지)
      </p>
      <p className="insurer-news-muted" style={{ fontSize: 12, marginTop: 4 }}>
        JPG · PNG · WEBP · GIF · PDF (이미지 최대 15MB, PDF 최대 40MB)
      </p>
    </div>
  )
}
