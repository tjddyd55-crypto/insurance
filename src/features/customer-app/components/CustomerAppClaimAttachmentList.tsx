import { resolveAbsoluteApiUrl } from '../../../lib/apiClient'
import type { CustomerAppClaimRequestDetailFile } from '../api/customerAppApi'
import {
  CLAIM_ATTACHMENT_DOWNLOAD_LINK_TARGET,
  getClaimAttachmentOpenLinkTarget,
  resolveClaimAttachmentDownloadHref,
  resolveClaimAttachmentOpenHref,
  resolveClaimAttachmentOpenUrl,
  shouldUseDirectClaimAttachmentNavigation,
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
  const openTarget = getClaimAttachmentOpenLinkTarget()
  const showMobileHint = shouldUseDirectClaimAttachmentNavigation()

  if (files.length === 0) {
    return <div className="customer-app-claim-empty customer-app-claim-empty--in-card">첨부 파일이 없습니다.</div>
  }

  return (
    <>
      <ul className="customer-app-claim-attachment-list">
        {files.map((file) => {
          const previewUrl = resolveAbsoluteApiUrl(resolveClaimAttachmentOpenUrl(file))
          const openHref = resolveClaimAttachmentOpenHref(file)
          const downloadHref = resolveClaimAttachmentDownloadHref(file)

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
                  {openHref ? (
                    <a
                      href={openHref}
                      target={openTarget}
                      rel="noopener noreferrer"
                      className="filter-button customer-app-claim-attachment__action"
                    >
                      열기
                    </a>
                  ) : (
                    <span
                      className="filter-button customer-app-claim-attachment__action customer-app-claim-attachment__action--disabled"
                      aria-disabled="true"
                    >
                      열기
                    </span>
                  )}
                  {downloadHref ? (
                    <a
                      href={downloadHref}
                      target={CLAIM_ATTACHMENT_DOWNLOAD_LINK_TARGET}
                      rel="noopener noreferrer"
                      className="filter-button customer-app-claim-attachment__action"
                    >
                      다운로드
                    </a>
                  ) : (
                    <span
                      className="filter-button customer-app-claim-attachment__action customer-app-claim-attachment__action--disabled"
                      aria-disabled="true"
                    >
                      다운로드
                    </span>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {showMobileHint ? (
        <p className="customer-app-claim-attachment-list__mobile-hint">
          모바일 환경에서는 파일이 새 화면으로 열릴 수 있습니다.
        </p>
      ) : null}
    </>
  )
}
