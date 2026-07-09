import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useSmsAutomationRulesState } from '../hooks/useSmsAutomationRulesState'
import SmsAutomationMobileView from './automation/SmsAutomationMobileView'
import SmsAutomationPCView, { type SmsAutomationViewProps } from './automation/SmsAutomationPCView'
import '../sms-automation.css'

export default function SmsAutomationPage() {
  const state = useSmsAutomationRulesState()
  return (
    <ResponsiveLayout<SmsAutomationViewProps>
      PC={SmsAutomationPCView}
      Mobile={SmsAutomationMobileView}
      viewProps={state}
    />
  )
}
