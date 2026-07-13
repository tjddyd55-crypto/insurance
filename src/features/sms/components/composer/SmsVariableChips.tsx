import { SMS_RESERVATION_VARIABLE_OPTIONS } from '../../config/smsVariables.config'
import SmsVariableButtons from '../common/SmsVariableButtons'

type Props = {
  onInsert: (token: string) => void
  disabled?: boolean
}

export default function SmsVariableChips({ onInsert, disabled = false }: Props) {
  return (
    <SmsVariableButtons
      variables={SMS_RESERVATION_VARIABLE_OPTIONS}
      onInsert={onInsert}
      disabled={disabled}
    />
  )
}
