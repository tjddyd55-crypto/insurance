import SmsModuleBody from '../../components/SmsModuleBody'
import type { SmsModuleViewProps } from '../../hooks/useSmsModuleState'

export default function SmsModuleMobileView(props: SmsModuleViewProps) {
  return (
    <main className="page sms-module-page sms-module-page--mobile page--with-back">
      <SmsModuleBody {...props} variant="mobile" />
    </main>
  )
}
