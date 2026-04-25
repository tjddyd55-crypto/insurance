import type { ReactNode } from 'react'
import ClaimRequestsPageMobileView from './ClaimRequestsPageMobileView'

type ClaimRequestsClaimsMobileLayoutProps = {
  linkSection: ReactNode
  connectionSection: ReactNode
  requestListSection: ReactNode
  detailModal: ReactNode
}

export default function ClaimRequestsClaimsMobileLayout({
  linkSection,
  connectionSection,
  requestListSection,
  detailModal,
}: ClaimRequestsClaimsMobileLayoutProps) {
  return (
    <ClaimRequestsPageMobileView
      linkSection={linkSection}
      connectionSection={connectionSection}
      requestListSection={requestListSection}
      detailModal={detailModal}
    />
  )
}
