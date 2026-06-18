import GaRequiredNotice from './access/GaRequiredNotice'

type GaRegistrationRequiredNoticeProps = {
  title?: string
  onConfirm?: () => void
}

/**
 * @deprecated {@link GaRequiredNotice} 사용. 하위 호환용 래퍼.
 */
export default function GaRegistrationRequiredNotice(_props: GaRegistrationRequiredNoticeProps) {
  return <GaRequiredNotice />
}
