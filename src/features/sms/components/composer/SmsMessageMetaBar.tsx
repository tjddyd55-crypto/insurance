import type { SmsMessageLengthIndicatorProps } from '../common/smsMessagePreview.types'
import SmsMessageLengthIndicator from '../common/SmsMessageLengthIndicator'

type Props = SmsMessageLengthIndicatorProps

export default function SmsMessageMetaBar(props: Props) {
  return <SmsMessageLengthIndicator {...props} />
}
