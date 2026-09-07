import GaRestrictedFeatureNotice from './GaRestrictedFeatureNotice'
import type { GaRestrictedFeatureKey } from '../../features/auth/gaRestrictedFeatures'

export type GaRequiredNoticeProps = {
  /** 기능별 안내 문구. 미지정 시 공통 문구 */
  feature?: GaRestrictedFeatureKey
}

/**
 * @deprecated `GaRestrictedFeatureNotice` 사용. 하위 호환 래퍼.
 */
export default function GaRequiredNotice({ feature = 'generic' }: GaRequiredNoticeProps) {
  return <GaRestrictedFeatureNotice feature={feature} />
}
