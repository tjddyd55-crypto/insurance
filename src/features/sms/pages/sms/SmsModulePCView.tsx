import SmsModuleBody from '../../components/SmsModuleBody'
import type { SmsModuleViewProps } from '../../hooks/useSmsModuleState'

export default function SmsModulePCView(props: SmsModuleViewProps) {
  return (
    <main className="page sms-module-page sms-module-page--pc page--with-back">
      <SmsModuleBody {...props} variant="pc" />
    </main>
  )
}
