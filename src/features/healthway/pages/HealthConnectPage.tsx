import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { healthwayApi } from '../api'
import type { PublicInfo } from '../types'
import HealthConnectPCView from './health-connect/HealthConnectPCView'
import HealthConnectMobileView from './health-connect/HealthConnectMobileView'
import '../healthway.css'
export type PublicController = ReturnType<typeof usePublicController>
function usePublicController() {
  const { token = '' } = useParams(), location = useLocation(), navigate = useNavigate()
  const [info, setInfo] = useState<PublicInfo | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [terms, setTerms] = useState(false), [nhis, setNhis] = useState(false), [hira, setHira] = useState(false), [medical, setMedical] = useState(false)
  const [isJoinPhr, setJoinPhr] = useState(false), [isJoinPortal, setJoinPortal] = useState(false), [sensitiveInformation, setSensitive] = useState(false)
  const auth = location.pathname.endsWith('/mock-auth')
  const binding = location.state as { nonce?: string; demandDealingsNo?: string } | null
  useEffect(() => {
    let active = true
    void healthwayApi<PublicInfo>(`/public/${token}`).then((data) => { if (active) setInfo(data) }).catch(() => { if (active) setError('만료·취소·완료되었거나 사용할 수 없는 링크입니다. 담당자에게 새 요청을 받아 주세요.') })
    return () => { active = false }
  }, [token])
  const act = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true); setError(''); try { await fn() } catch { setError('테스트 요청을 완료하지 못했습니다. 담당자에게 요청 상태를 확인해 주세요.') } finally { setBusy(false) }
  }, [])
  const start = () => act(async () => {
    const result = await healthwayApi<{ mockAuthPath: string; nonce: string; demandDealingsNo: string }>(`/public/${token}/start`, null,
      { terms, institutions: [...(nhis ? ['NHIS'] : []), ...(hira ? ['HIRA'] : [])], medical, isJoinPhr, isJoinPortal, sensitiveInformation })
    navigate(result.mockAuthPath, { state: { nonce: result.nonce, demandDealingsNo: result.demandDealingsNo }, replace: true })
  })
  const complete = () => act(async () => {
    if (!binding?.nonce || !binding.demandDealingsNo) throw new Error('binding_missing')
    await healthwayApi(`/public/${token}/mock-auth`, null, binding)
    const data = await healthwayApi<PublicInfo>(`/public/${token}`); setInfo(data)
    navigate(`/health-connect/${token}`, { replace: true, state: null })
  })
  const valid = terms && (!info?.request.sources.includes('NHIS') || nhis) && (!info?.request.sources.includes('HIRA') || hira) && (!info?.request.medical || medical)
  return { info, error, busy, terms, setTerms, nhis, setNhis, hira, setHira, medical, setMedical, isJoinPhr, setJoinPhr, isJoinPortal, setJoinPortal,
    sensitiveInformation, setSensitive, auth, hasBinding: !!binding?.nonce, valid, start, complete }
}
function PublicConnect() {
  const controller = usePublicController()
  return <ResponsiveLayout PC={HealthConnectPCView} Mobile={HealthConnectMobileView} viewProps={{ controller }} />
}
export default function HealthConnectPage() {
  const { token } = useParams()
  return <PublicConnect key={token} />
}
