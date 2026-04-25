import { useSearchParams } from 'react-router-dom'
import useIsMobile from '../../../hooks/useIsMobile'
import ClaimRequestsClaimsMobileStandalone from './claim-requests/ClaimRequestsClaimsMobileStandalone'
import ClaimRequestsPage from './ClaimRequestsPage'

export default function ClaimRequestsRoutePage() {
  const isMobile = useIsMobile()
  const [searchParams] = useSearchParams()
  const claimTabParam = searchParams.get('claimTab')
  const isClaimsTab = !claimTabParam || claimTabParam === 'claims'

  if (isMobile && isClaimsTab) {
    return <ClaimRequestsClaimsMobileStandalone />
  }

  return <ClaimRequestsPage />
}
