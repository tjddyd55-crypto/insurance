import type { ReactNode } from 'react'

type ClaimRequestsPageMobileViewProps = {
  children: ReactNode
}

export default function ClaimRequestsPageMobileView({ children }: ClaimRequestsPageMobileViewProps) {
  return (
    <main className="page claim-requests-page claim-requests-page--mobile page--with-back content-wrapper space-y-4">
      {children}
    </main>
  )
}

