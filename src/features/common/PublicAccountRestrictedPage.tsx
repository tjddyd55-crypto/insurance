import { useSearchParams } from 'react-router-dom'
import GaRestrictedFeatureNotice from '../../components/access/GaRestrictedFeatureNotice'
import { resolveGaRestrictedFeatureFromPath } from '../auth/gaRestrictedFeatures'

/**
 * GA 미소속 사용자가 GA 전용 메뉴·URL에 접근할 때 표시한다.
 */
export default function PublicAccountRestrictedPage() {
  const [searchParams] = useSearchParams()
  const from = searchParams.get('from') ?? ''
  const feature = resolveGaRestrictedFeatureFromPath(from)

  return <GaRestrictedFeatureNotice feature={feature} />
}
