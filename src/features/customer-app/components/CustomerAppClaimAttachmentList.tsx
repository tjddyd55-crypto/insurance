import { useState } from 'react'
import { resolveAbsoluteApiUrl } from '../../../lib/apiClient'
import type { CustomerAppClaimRequestDetailFile } from '../api/customerAppApi'
import {
  handleDownloadClaimAttachment,
  handleOpenClaimAttachment,
  resolveClaimAttachmentOpenUrl,
} from '../utils/claimAttachmentActions'

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1) {
    return '0 KB'
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }
  return `${Math.ceil(bytes / 1024)} KB`
}

function isImageFile(contentType: string): boolean {
  return String(contentType ?? '').startsWith('image/')
}

type Props = {
  files: CustomerAppClaimRequestDetailFile[]
}

export default function CustomerAppClaimAttachmentList({ files }: Props) {
  const [busyId, setBusyId] = useState<number | null>(null)

  if (files.length === 0) {
    return <div className="customer-app-claim-empty customer-app-claim-empty--in-card">첨부 파일이 없습니다.</div>
  }

  const runOpen = (file: CustomerAppClaimRequestDetailFile) => {
    setBusyId(file.id)
    try {
      handleOpenClaimAttachment(file)
    } finally {
      window.setTimeout(() => setBusyId(null), 400)
    }
  }

  const runDownload = (file: CustomerAppClaimRequestDetailFile) => {
    setBusyId(file.id)
    try {
      handleDownloadClaimAttachment(file)
    } finally {
      window.setTimeout(() => setBusyId(null), 400)
    }
  }

  return (
    <ul className="customer-app-claim-attachment-list">
      {files.map((file) => {
        const previewUrl = resolveAbsoluteApiUrl(resolveClaimAttachmentOpenUrl(file))
        const busy = busyId === file.id
        return (
          <li key={file.id} className="customer-app-claim-attachment">
            <div className="customer-app-claim-attachment__preview">
              {isImageFile(file.contentType) && previewUrl ? (
                <img
                  className="customer-app-claim-attachment__thumb"
                  src={previewUrl}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <span className="customer-app-claim-attachment__placeholder">PDF</span>
              )}
            </div>
            <div className="customer-app-claim-attachment__main">
              <span className="customer-app-claim-attachment__name">{file.fileName}</span>
              <span className="customer-app-claim-attachment__meta">{formatFileSize(file.fileSize)}</span>
              <div className="customer-app-claim-attachment__actions">
                <button
                  type="button"
                  className="filter-button customer-app-claim-attachment__action"
                  disabled={busy}
                  onClick={() => runOpen(file)}
                >
                  {busy ? '처리 중…' : '열기'}
                </button>
                <button
                  type="button"
                  className="filter-button customer-app-claim-attachment__action"
                  disabled={busy}
                  onClick={() => runDownload(file)}
                >
                  다운로드
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
