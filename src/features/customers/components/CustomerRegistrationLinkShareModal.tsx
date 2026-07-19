import CustomerLinkShareModal from './CustomerLinkShareModal'

type Props = {
  open: boolean
  token: string | null | undefined
  username: string
  gaCode: string
  onClose: () => void
  onFeedback: (message: string) => void
}

/** 고객등록 발송 — 공통 CustomerLinkShareModal(registration) 래퍼 */
export default function CustomerRegistrationLinkShareModal(props: Props) {
  return <CustomerLinkShareModal mode="registration" {...props} />
}
