import type { SmsMessageLengthIndicatorProps } from '../common/smsMessagePreview.types'
import SmsMessageLengthIndicator from '../common/SmsMessageLengthIndicator'

type Props = SmsMessageLengthIndicatorProps

/** 호환용 wrapper — byte/유형 UI SSOT는 SmsMessageLengthIndicator */
export default function SmsMessageMetaBar(props: Props) {
  return <SmsMessageLengthIndicator {...props} />
}
