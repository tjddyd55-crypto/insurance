import { useNavigate, useParams } from 'react-router-dom'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useSmsModuleState, type SmsModuleViewProps } from '../hooks/useSmsModuleState'
import type { SmsModuleTab } from '../types/sms.types'
import SmsModuleMobileView from './sms/SmsModuleMobileView'
import SmsModulePCView from './sms/SmsModulePCView'
import '../sms-module.css'

const TAB_IDS: SmsModuleTab[] = [
  'settings',
  'send',
  'bulk',
  'scheduled',
  'templates',
  'history',
  'opt-outs',
]

function parseTab(raw: string | undefined): SmsModuleTab {
  if (raw && TAB_IDS.includes(raw as SmsModuleTab)) {
    return raw as SmsModuleTab
  }
  return 'settings'
}

export default function SmsModulePage() {
  const navigate = useNavigate()
  const params = useParams()
  const initialTab = parseTab(params.tab)
  const state = useSmsModuleState(initialTab)

  const viewProps: SmsModuleViewProps = {
    ...state,
    setTab: (tab) => {
      state.setTab(tab)
      navigate(`/sms/${tab}`, { replace: true })
    },
  }

  return <ResponsiveLayout<SmsModuleViewProps> PC={SmsModulePCView} Mobile={SmsModuleMobileView} viewProps={viewProps} />
}
