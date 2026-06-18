import GaRequiredNotice from '../../components/access/GaRequiredNotice'

/**
 * 공용(GENERAL) 계정이 GA 전용 메뉴(신청서·전자서명·팀·GA전용 소식지)에 접근할 때 표시한다.
 */
export default function PublicAccountRestrictedPage() {
  return <GaRequiredNotice />
}
