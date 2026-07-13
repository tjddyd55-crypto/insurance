import FormButton from '../../../../components/form/FormButton'
import { SMS_VARIABLE_BUTTONS_DEFAULT_HINT } from '../../config/smsVariables.config'
import type { SmsVariableOption } from '../../types/smsVariable.types'

export type SmsVariableButtonsProps = {
  variables: SmsVariableOption[]
  onInsert: (token: string) => void
  disabled?: boolean
  hint?: string
  className?: string
}

export function SmsVariableButtons({
  variables,
  onInsert,
  disabled = false,
  hint = SMS_VARIABLE_BUTTONS_DEFAULT_HINT,
  className,
}: SmsVariableButtonsProps) {
  return (
    <div
      className={`sms-automation-rules__variable-buttons sms-variable-buttons${className ? ` ${className}` : ''}`}
      aria-label="사용 가능한 변수"
    >
      <span className="sms-automation-rules__label sms-variable-buttons__label">사용 가능한 변수</span>
      <div className="sms-automation-rules__variable-button-row sms-variable-buttons__row">
        {variables.map((option) => (
          <FormButton
            key={option.token}
            htmlType="button"
            variant="secondary"
            className="sms-automation-rules__variable-button sms-variable-buttons__button"
            disabled={disabled}
            onClick={() => onInsert(option.token)}
          >
            {option.label}
          </FormButton>
        ))}
      </div>
      <p className="sms-automation-rules__hint sms-variable-buttons__hint">{hint}</p>
    </div>
  )
}

export default SmsVariableButtons
