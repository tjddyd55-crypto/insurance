import { useParams, useSearchParams } from 'react-router-dom'
import useIsMobile from '../../../hooks/useIsMobile'
import ClaimRequestsAllNewsMobileStandalone from './claim-requests/ClaimRequestsAllNewsMobileStandalone'
import ClaimRequestsClaimsMobileStandalone from './claim-requests/ClaimRequestsClaimsMobileStandalone'
import ClaimRequestsPersonalMobileStandalone from './claim-requests/ClaimRequestsPersonalMobileStandalone'
import ClaimInboxPage from './ClaimInboxPage'
import ClaimRequestsPage from './ClaimRequestsPage'

export default function ClaimRequestsRoutePage() {
  const isMobile = useIsMobile()
  const { customerId } = useParams<{ customerId?: string }>()
  const [searchParams] = useSearchParams()
  const claimTabParam = searchParams.get('claimTab')
  const hasCustomerContext = Boolean(customerId?.trim())
  const isInboxTab = !hasCustomerContext && (!claimTabParam || claimTabParam === 'inbox')
  const isClaimsTab = hasCustomerContext
    ? !claimTabParam || claimTabParam === 'claims'
    : claimTabParam === 'claims'
  const isPersonalTab = claimTabParam === 'news-personal'
  const isAllNewsTab = claimTabParam === 'news-all'

  if (isInboxTab) {
    return <ClaimInboxPage />
  }

  if (isMobile && isClaimsTab) {
    return <ClaimRequestsClaimsMobileStandalone />
  }

  if (isMobile && isPersonalTab) {
    return <ClaimRequestsPersonalMobileStandalone />
  }

  if (isMobile && isAllNewsTab) {
    return <ClaimRequestsAllNewsMobileStandalone />
  }

  return <ClaimRequestsPage />
}
