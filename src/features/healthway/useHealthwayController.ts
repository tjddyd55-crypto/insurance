import { useCallback, useEffect, useState } from 'react'
import { healthwayApi } from './api'
import type { Analysis, AnalysisResponse, HealthRecord, HealthRequest, RecordsResponse, SourceTab } from './types'
export function useHealthwayController(customerId: number, token: string | null) {
  const [tab, setTab] = useState<SourceTab>('NHIS'), [requests, setRequests] = useState<HealthRequest[]>([])
  const [data, setData] = useState<RecordsResponse>({ records: [], coverage: [], offlineAsOfDate: '', mock: true })
  const [results, setResults] = useState<Analysis[]>([]), [evidence, setEvidence] = useState<HealthRecord[] | null>(null)
  const [linkPath, setLinkPath] = useState(''), [linkRequestId, setLinkRequestId] = useState(''), [sms, setSms] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [enabled, setEnabled] = useState<boolean | null>(null)
  const [nhis, setNhis] = useState(true), [hira, setHira] = useState(true), [medical, setMedical] = useState(false)
  const [savedSelection, setSavedSelection] = useState({ nhis: true, hira: true, medical: false })
  const dirty = nhis !== savedSelection.nhis || hira !== savedSelection.hira || medical !== savedSelection.medical
  const [confirm, setConfirm] = useState<{ title: string; action: () => Promise<void> } | null>(null)
  const base = `/customers/${customerId}`
  const load = useCallback(async () => {
    const [req, records, analysis] = await Promise.all([
      healthwayApi<{ requests: HealthRequest[] }>(`${base}/requests`, token),
      healthwayApi<RecordsResponse>(`${base}/records`, token), healthwayApi<AnalysisResponse>(`${base}/analysis`, token),
    ])
    setRequests(req.requests); setData(records); setResults(analysis.results)
  }, [base, token])
  const perform = useCallback(async (action: () => Promise<void>) => {
    setBusy(true); setError('')
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : '요청을 처리하지 못했습니다.') } finally { setBusy(false) }
  }, [])
  useEffect(() => {
    let live = true
    void healthwayApi('/availability', token).then(() => { if (live) { setEnabled(true); void perform(load) } }).catch(() => { if (live) setEnabled(false) })
    return () => { live = false }
  }, [token, load, perform])
  const create = () => perform(async () => {
    const created = await healthwayApi<{ request: HealthRequest; linkPath: string }>(`${base}/requests`, token, { sources: [...(nhis ? ['NHIS'] : []), ...(hira ? ['HIRA'] : [])], medical })
    setSavedSelection({ nhis, hira, medical }); setLinkPath(created.linkPath); setLinkRequestId(created.request.id); setSms(''); await load()
  })
  const preview = () => perform(async () => {
    const response = await healthwayApi<{ message: string }>(`${base}/requests/${linkRequestId}/sms-preview`, token, { linkPath })
    setSms(response.message.replace(linkPath, new URL(linkPath, window.location.origin).href))
  })
  const cancel = (id: string) => setConfirm({ title: '이 건강정보 요청을 취소하시겠습니까?', action: async () => {
    await healthwayApi(`${base}/requests/${id}/cancel`, token, {}); if (id === linkRequestId) { setLinkPath(''); setSms('') } await load()
  } })
  const revoke = () => setConfirm({ title: '건강정보 연결을 해제하고 저장된 건강정보를 삭제하시겠습니까?', action: async () => {
    await healthwayApi(`${base}/revoke`, token, {}); setLinkPath(''); setSms(''); setEvidence(null); await load()
  } })
  return { tab, setTab, requests, data, results, evidence, setEvidence, linkPath, sms, busy, error, enabled, nhis, setNhis, hira, setHira, medical, setMedical,
    confirm, setConfirm, perform, load, create, preview, cancel, revoke, dirty }
}
export type HealthwayController = ReturnType<typeof useHealthwayController>
