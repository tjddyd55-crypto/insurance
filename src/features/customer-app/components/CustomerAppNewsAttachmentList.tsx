import { useState } from 'react'
import { resolveAbsoluteApiUrl } from '../../../lib/apiClient'
import type { CustomerAppNewsAttachment } from '../api/customerAppApi'

function formatFileSize(bytes: number | null | undefined): string {
  const n = Number(bytes ?? 0)
  if (!Number.isFinite(n) || n < 1) {
    return ''
  }
  if (n < 1024) {
    return `${n}B`
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)}KB`
  }
  return `${(n / (1024 * 1024)).toFixed(1)}MB`
}

function isImageAttachment(row: CustomerAppNewsAttachment): boolean {
  if (row.kind === 'image') {
    return true
  }
  const mime = String(row.mimeType ?? '').toLowerCase()
  return mime.startsWith('image/')
}

function resolveAttachmentOpenUrl(row: CustomerAppNewsAttachment): string {
  return String(row.openUrl ?? row.url ?? '').trim()
}

function resolveAttachmentDownloadUrl(row: CustomerAppNewsAttachment): string {
  return String(row.downloadUrl ?? row.openUrl ?? row.url ?? '').trim()
}

async function fetchAttachmentBlob(url: string, appToken: string): Promise<Blob> {
  const href = resolveAbsoluteApiUrl(url)
  const hasAccessToken = href.includes('accessToken=')
  const response = await fetch(href, {
    method: 'GET',
    headers: hasAccessToken ? {} : { Authorization: `Bearer ${appToken.trim()}` },
  })
  if (!response.ok) {
    throw new Error('첨부파일을 불러오지 못했습니다.')
  }
  return response.blob()
}

type Props = {
  attachments: CustomerAppNewsAttachment[]
  appToken: string
}

function CustomerAppNewsImageAttachment({
  row,
  appToken,
  onError,
}: {
  row: CustomerAppNewsAttachment
  appToken: string
  onError: () => void
}) {
  const src = resolveAbsoluteApiUrl(resolveAttachmentOpenUrl(row))
  if (!src) {
    onError()
    return null
  }
  return (
    <img
      className="customer-app-news-attachments__image"
      src={src}
      alt={row.fileName || '첨부 이미지'}
      loading="lazy"
      decoding="async"
      onError={onError}
    />
  )
}

export default function CustomerAppNewsAttachmentList({ attachments, appToken }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(() => new Set())

  const sorted = [...attachments].sort((a, b) => a.sortOrder - b.sortOrder)
  const images = sorted.filter(isImageAttachment)
  const files = sorted.filter((row) => !isImageAttachment(row))

  if (images.length === 0 && files.length === 0) {
    return null
  }

  const runWithBlob = async (row: CustomerAppNewsAttachment, mode: 'open' | 'download') => {
    setBusyId(row.id)
    setError('')
    try {
      const sourceUrl =
        mode === 'download' ? resolveAttachmentDownloadUrl(row) : resolveAttachmentOpenUrl(row)
      if (!sourceUrl) {
        throw new Error('첨부파일 주소가 없습니다.')
      }
      const blob = await fetchAttachmentBlob(sourceUrl, appToken)
      const objectUrl = URL.createObjectURL(blob)
      if (mode === 'open') {
        window.open(objectUrl, '_blank', 'noopener,noreferrer')
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
        return
      }
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = row.fileName || 'download'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (e) {
      setError(e instanceof Error ? e.message : '첨부파일을 열 수 없습니다.')
    } finally {
      setBusyId(null)
    }
  }

  const markImageBroken = (id: string) => {
    setBrokenImageIds((prev) => {
      if (prev.has(id)) {
        return prev
      }
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  const renderFileRow = (row: CustomerAppNewsAttachment) => {
    const sizeLabel = formatFileSize(row.size)
    const busy = busyId === row.id
    return (
      <li key={row.id} className="customer-app-news-attachments__item">
        <div className="customer-app-news-attachments__meta">
          <span className="customer-app-news-attachments__name">{row.fileName || '첨부파일'}</span>
          {sizeLabel ? <span className="customer-app-news-attachments__size">{sizeLabel}</span> : null}
        </div>
        <div className="customer-app-news-attachments__actions">
          <button
            type="button"
            className="filter-button customer-app-news-attachments__btn"
            disabled={busy}
            onClick={() => void runWithBlob(row, 'open')}
          >
            {busy ? '처리 중…' : '열기'}
          </button>
          <button
            type="button"
            className="filter-button customer-app-news-attachments__btn"
            disabled={busy}
            onClick={() => void runWithBlob(row, 'download')}
          >
            다운로드
          </button>
        </div>
      </li>
    )
  }

  return (
    <section className="customer-app-news-attachments" aria-label="첨부파일">
      {images.length > 0 ? (
        <div className="customer-app-news-attachments__images">
          {images.map((row) => {
            if (brokenImageIds.has(row.id)) {
              return (
                <div key={row.id} className="customer-app-news-attachments__broken">
                  <p className="customer-app-news-attachments__broken-text">이미지를 불러오지 못했습니다.</p>
                  <ul className="customer-app-news-attachments__list customer-app-news-attachments__list--fallback">
                    {renderFileRow(row)}
                  </ul>
                </div>
              )
            }
            return (
              <figure key={row.id} className="customer-app-news-attachments__figure">
                <CustomerAppNewsImageAttachment
                  row={row}
                  appToken={appToken}
                  onError={() => markImageBroken(row.id)}
                />
                {row.fileName ? (
                  <figcaption className="customer-app-news-attachments__caption">{row.fileName}</figcaption>
                ) : null}
              </figure>
            )
          })}
        </div>
      ) : null}

      {files.length > 0 ? (
        <>
          <h2 className="customer-app-news-attachments__title">첨부파일</h2>
          {error ? (
            <p className="customer-app-news-attachments__error" role="alert">
              {error}
            </p>
          ) : null}
          <ul className="customer-app-news-attachments__list">{files.map(renderFileRow)}</ul>
        </>
      ) : error ? (
        <p className="customer-app-news-attachments__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
