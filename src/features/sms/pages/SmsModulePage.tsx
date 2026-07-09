import { useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useSmsModuleState, type SmsModuleViewProps } from '../hooks/useSmsModuleState'
import type { SmsModuleTab } from '../types/sms.types'
import SmsModuleMobileView from './sms/SmsModuleMobileView'
import SmsModulePCView from './sms/SmsModulePCView'
import '../sms-module.css'

const ROUTE_TAB_IDS: SmsModuleTab[] = [
  'settings',
  'send',
  'reservations',
  'groups',
  'templates',
  'history',
]

const LEGACY_TAB_PATH: Record<string, string> = {
  bulk: '/sms/groups',
  scheduled: '/sms/reservations',
  'opt-outs': '/sms/settings',
}

function parseTab(raw: string | undefined): SmsModuleTab {
  if (raw && ROUTE_TAB_IDS.includes(raw as SmsModuleTab)) {
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

  useEffect(() => {
    if (rawTab === 'send' && searchParams.get('mode') === 'reserved') {
      navigate('/sms/reservations', { replace: true })
    }
  }, [navigate, rawTab, searchParams])

  const initialTab = parseTab(rawTab)
  const state = useSmsModuleState(initialTab)

  const viewProps: SmsModuleViewProps = {
    ...state,
    sendMode: initialTab === 'reservations' ? 'reserved' : 'immediate',
    setTab: (tab) => {
      state.setTab(tab)
      navigate(`/sms/${tab}`, { replace: true })
    },
    navigateToSend: (options) => {
      if (options?.mode === 'reserved') {
        state.setTab('reservations')
        navigate('/sms/reservations', { replace: true })
        return
      }
      state.setTab('send')
      navigate('/sms/send', { replace: true })
    },
  }

  if (rawTab && LEGACY_TAB_PATH[rawTab]) {
    return null
  }

  if (rawTab === 'send' && searchParams.get('mode') === 'reserved') {
    return null
  }

  return <ResponsiveLayout<SmsModuleViewProps> PC={SmsModulePCView} Mobile={SmsModuleMobileView} viewProps={viewProps} />
}
