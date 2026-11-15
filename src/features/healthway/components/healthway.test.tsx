import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import HealthwayPCView from '../pages/healthway/HealthwayPCView'
import HealthwayMobileView from '../pages/healthway/HealthwayMobileView'
import HealthConnectPCView from '../pages/health-connect/HealthConnectPCView'
import HealthConnectMobileView from '../pages/health-connect/HealthConnectMobileView'
import type { HealthwayController } from '../useHealthwayController'
import type { PublicController } from '../pages/HealthConnectPage'
// OUR normalized contract fixtures only, deliberately nonclinical test values.
const noop = vi.fn()
function controller(): HealthwayController {
  return { enabled: true, tab: 'NHIS', setTab: noop, requests: [], data: { records: [{ id: 'test-v', source: 'NHIS_PUBLIC', datasetCode: '2002', kind: 'visit', date: '2024-01-01', institution: { name: 'TEST FACILITY' }, visitType: 'institutional' }], coverage: [{ datasetCode: '2002', source: 'NHIS_PUBLIC', availableFrom: '2023-06-01', availableTo: '2024-06-01', basis: 'official-rule', basisLabel: '공식 조회 규칙', offlineAsOfDate: '2024-08-01', hasData: true }], offlineAsOfDate: '2024-08-01', mock: true },
    results: [], evidence: null, setEvidence: noop, linkPath: '', sms: '', busy: false, error: '', nhis: true, setNhis: noop, hira: true, setHira: noop, medical: false, setMedical: noop,
    confirm: null, setConfirm: noop, perform: noop, load: noop, create: noop, preview: noop, cancel: noop, revoke: noop }
}
describe('Healthway views', () => {
  it.each([HealthwayPCView, HealthwayMobileView])('separates NHIS / HIRA, labels sample coverage, no fabricated diagnosis', (View) => {
    const html = renderToStaticMarkup(<View controller={controller()} />)
    expect(html).toContain('국민건강보험공단'); expect(html).toContain('심사평가원'); expect(html).toContain('고지의무 확인')
    expect(html).toContain('오프라인 샘플 기준일'); expect(html).toContain('2023.06.01'); expect(html).not.toContain('<th>진단')
  })
  it('displays INSUFFICIENT_DATA and UNSUPPORTED without a pass claim', () => {
    const c = controller(); c.tab = 'DISCLOSURE'; c.results = [{ ruleCode: 'test', name: '5년 반복', status: 'INSUFFICIENT_DATA', statusLabel: '데이터 부족', evidenceIds: [], count: 0, estimated: false, note: '요구 기간 전체 미확보', ruleVersion: 'TEST', window: { from: '2019-01-01', to: '2024-01-01' } }]
    const html = renderToStaticMarkup(<HealthwayPCView controller={c} />)
    expect(html).toContain('데이터 부족'); expect(html).toContain('공공데이터만으로는 확인 불가'); expect(html).not.toContain('hw-status--NOT_DETECTED')
  })
  it('shows medication raw code / product without invented classes', () => {
    const c = controller(); c.tab = 'HIRA'; c.data.records = [{ id: 'd', source: 'HIRA_PUBLIC', datasetCode: '2004', kind: 'dispense', drugCodeRaw: 'TEST-0001', productName: 'TEST PRODUCT', daysSupply: 10 }]
    const html = renderToStaticMarkup(<HealthwayPCView controller={c} />)
    expect(html).toContain('TEST-0001'); expect(html).toContain('TEST PRODUCT'); expect(html).not.toContain('고혈압약')
  })
  it('disabled module has no request controls', () => {
    const c = controller(); c.enabled = false
    const html = renderToStaticMarkup(<HealthwayPCView controller={c} />)
    expect(html).toContain('비활성화'); expect(html).not.toContain('요청 생성')
  })
  it.each([HealthConnectPCView, HealthConnectMobileView])('public page is explicitly MOCK with separate institution consents', (View) => {
    const c = { info: { request: { status: 'opened', sources: ['NHIS', 'HIRA'], medical: false, expiresAt: '2024-01-01' }, maskedName: 'T***', offlineAsOfDate: '2024-08-01', terms: [], unityTerms: [] }, busy: false, error: '', auth: false, valid: false } as unknown as PublicController
    const html = renderToStaticMarkup(<View controller={c} />)
    expect(html).toContain('DEV MOCK'); expect(html).toContain('국민건강보험공단'); expect(html).toContain('심사평가원'); expect(html).toContain('실제 본인인증이나 건강정보 조회를 하지 않습니다')
    expect(html).toMatch(/disabled=""/)
  })
})
