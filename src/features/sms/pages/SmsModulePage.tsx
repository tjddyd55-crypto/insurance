import { useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useSmsModuleState, type SmsModuleViewProps } from '../hooks/useSmsModuleState'
import type { SmsModuleTab } from '../types/sms.types'
import SmsModuleMobileView from './sms/SmsModuleMobileView'
import SmsModulePCView from './sms/SmsModulePCView'
import '../sms-module.css'

const TAB_IDS: SmsModuleTab[] = ['settings', 'groups', 'send', 'history']

const LEGACY_TAB_PATH: Record<string, string> = {
  bulk: '/sms/groups',
  scheduled: '/sms/send?mode=reserved',
  templates: '/sms/send',
  'opt-outs': '/sms/settings',
}

function parseTab(raw: string | undefined): SmsModuleTab {
  if (raw && TAB_IDS.includes(raw as SmsModuleTab)) {
    return raw as SmsModuleTab
  }
  return 'settings'
}

export default function SmsModulePage() {
  const navigate = useNavigate()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const rawTab = params.tab

  useEffect(() => {
    if (rawTab && LEGACY_TAB_PATH[rawTab]) {
      navigate(LEGACY_TAB_PATH[rawTab], { replace: true })
    }
  }, [navigate, rawTab])

  const initialTab = parseTab(rawTab)
  const state = useSmsModuleState(initialTab)

  const viewProps: SmsModuleViewProps = {
    ...state,
    sendMode: searchParams.get('mode') === 'reserved' ? 'reserved' : 'immediate',
    setTab: (tab) => {
      state.setTab(tab)
      navigate(`/sms/${tab}`, { replace: true })
    },
    navigateToSend: (options) => {
      const query = options?.mode === 'reserved' ? '?mode=reserved' : ''
      state.setTab('send')
      navigate(`/sms/send${query}`, { replace: true })
    },
  }

  if (rawTab && LEGACY_TAB_PATH[rawTab]) {
    return null
  }

  return <ResponsiveLayout<SmsModuleViewProps> PC={SmsModulePCView} Mobile={SmsModuleMobileView} viewProps={viewProps} />
}
