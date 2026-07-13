import {
  getAutomationVariableOptions,
  SMS_VARIABLE_BUTTONS_AUTOMATION_HINT,
} from '../../config/smsVariables.config'
import type { SmsAutomationTriggerType } from '../../types/smsAutomationRuleTypes'
import SmsVariableButtons from '../common/SmsVariableButtons'

export type SmsAutomationVariableButtonsProps = {
  triggerType: SmsAutomationTriggerType
  onInsert: (token: string) => void
}

export function SmsAutomationVariableButtons({
  triggerType,
  onInsert,
}: SmsAutomationVariableButtonsProps) {
  return (
    <SmsVariableButtons
      variables={getAutomationVariableOptions(triggerType)}
      onInsert={onInsert}
      hint={SMS_VARIABLE_BUTTONS_AUTOMATION_HINT}
    />
  )
}
