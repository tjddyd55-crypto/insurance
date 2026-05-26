import { FormButton } from '../../../components/form'
import type { ClaimRequestFileItem } from '../api/claimRequestsApi'
import {
  AGENT_CLAIM_FILE_DOWNLOAD_LINK_TARGET,
  AGENT_CLAIM_FILE_OPEN_LINK_TARGET,
  resolveAgentClaimFileDownloadAuthHref,
  resolveAgentClaimFileOpenHref,
} from '../utils/claimRequestFileActions'

type ClaimRequestFileActionsProps = {
  file: ClaimRequestFileItem
  useNativeLinks: boolean
  onOpenFile: (file: ClaimRequestFileItem) => void | Promise<void>
  onDownloadFile: (file: ClaimRequestFileItem) => void | Promise<void>
}

export default function ClaimRequestFileActions({
  file,
  useNativeLinks,
  onOpenFile,
  onDownloadFile,
}: ClaimRequestFileActionsProps) {
  const openHref = resolveAgentClaimFileOpenHref(file)
  const downloadHref = resolveAgentClaimFileDownloadAuthHref(file)

  if (useNativeLinks) {
    return (
      <div className="claim-requests-page__file-actions">
        {openHref ? (
          <a
            href={openHref}
            target={AGENT_CLAIM_FILE_OPEN_LINK_TARGET}
            rel="noopener noreferrer"
            className="button button--secondary"
          >
            열기
          </a>
        ) : (
          <span className="button button--secondary claim-requests-page__file-action--disabled" aria-disabled="true">
            열기
          </span>
        )}
        {downloadHref ? (
          <a
            href={downloadHref}
            target={AGENT_CLAIM_FILE_DOWNLOAD_LINK_TARGET}
            rel="noopener noreferrer"
            className="button button--secondary"
          >
            다운로드
          </a>
        ) : (
          <span className="button button--secondary claim-requests-page__file-action--disabled" aria-disabled="true">
            다운로드
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="claim-requests-page__file-actions">
      <FormButton htmlType="button" variant="secondary" onClick={() => void onOpenFile(file)}>
        열기
      </FormButton>
      <FormButton htmlType="button" variant="secondary" onClick={() => void onDownloadFile(file)}>
        다운로드
      </FormButton>
    </div>
  )
}
