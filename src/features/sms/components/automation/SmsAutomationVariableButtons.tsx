import FormButton from '../../../../components/form/FormButton'
import {
  getAutomationVariableOptions,
  type SmsAutomationVariableOption,
} from '../../config/smsAutomationRule.config'
import type { SmsAutomationTriggerType } from '../../types/smsAutomationRuleTypes'

export type SmsAutomationVariableButtonsProps = {
  triggerType: SmsAutomationTriggerType
  onInsert: (token: string) => void
}

export function SmsAutomationVariableButtons({
  triggerType,
  onInsert,
}: SmsAutomationVariableButtonsProps) {
  const options = getAutomationVariableOptions(triggerType)

  return (
    <div className="sms-automation-rules__variable-buttons" aria-label="사용 가능한 변수">
      <span className="sms-automation-rules__label">사용 가능한 변수</span>
      <div className="sms-automation-rules__variable-button-row">
        {options.map((option: SmsAutomationVariableOption) => (
          <FormButton
            key={option.token}
            htmlType="button"
            variant="secondary"
            className="sms-automation-rules__variable-button"
            onClick={() => onInsert(option.token)}
          >
            {option.label}
          </FormButton>
        ))}
      </div>
      <p className="sms-automation-rules__hint">
        버튼을 누르면 문자 내용에 변수가 추가됩니다. 미리보기에서 실제 고객 정보로 치환됩니다.
      </p>
    </div>
  )
}
