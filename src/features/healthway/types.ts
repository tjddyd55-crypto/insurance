export type SourceTab = 'NHIS' | 'HIRA' | 'DISCLOSURE'
export type HealthRecord = {
  id: string; source: string; datasetCode: string; kind: string; date?: string
  institution?: { name?: string }; checkupType?: string; conclusion?: string
  items?: { esiCode: string; name: string; value?: unknown; unit?: string }[]
  visitType?: string; visitHospitalDays?: number; prescriptionCount?: number; treatmentDays?: number
  copay?: { value: number; currency: string }; benefit?: { value: number; currency: string }
  drugCodeRaw?: string; drugCodeSystem?: string; productName?: string; daysSupply?: number
  dosesPerDay?: number; dosePerAdministration?: number; ingredients?: { code?: string; display?: string }[]
  kcdCodeRaw?: string; sourceDisplay?: string; kcd?: { display: string; nameBasis: string }
  encounterPeriod?: { start?: string; end?: string }; encounterClass?: { code?: string }
  diagnosisCandidates?: { evidenceId: string; label: string; relationship: string }[]
}
export type Coverage = {
  source: string; datasetCode: string; availableFrom: string | null; availableTo: string | null
  basis: string; basisLabel: string; offlineAsOfDate: string; hasData: boolean
}
export type HealthRequest = { id: string; status: string; sources: string[]; medical: boolean; expiresAt: string; timeline: { status: string; at: string }[] }
export type Analysis = { ruleCode: string; name: string; status: 'DETECTED' | 'NOT_DETECTED' | 'INSUFFICIENT_DATA' | 'UNSUPPORTED'; statusLabel: string
  evidenceIds: string[]; count: number; estimated: boolean; note: string; ruleVersion: string; window: { from: string; to: string } }
export type RecordsResponse = { records: HealthRecord[]; coverage: Coverage[]; offlineAsOfDate: string; mock: boolean }
export type AnalysisResponse = { results: Analysis[]; evidence: HealthRecord[]; offlineAsOfDate: string }
export type PublicInfo = {
  request: HealthRequest; maskedName: string; offlineAsOfDate: string; label: string
  terms?: { termsNo: string; termsName: string; termsContents: string; agreementSystemDivisionCode: string }[]
  unityTerms?: { serviceCode: string; termsName: string; termsContents: string }[]
}
export const requestLabels: Record<string, string> = {
  created: '요청 생성', opened: '링크 확인', consented: '동의 완료', auth_pending: 'MOCK 인증 대기', processing: '공식 샘플 조회 중',
  authenticated: 'MOCK 인증 완료', dataset_consented: '항목동의 완료', signed_mock: 'MOCK 전송요구 완료', completed: '연결 완료',
  expired: '만료', failed: '실패 · 새 요청 필요', revoked: '연결 해제', cancelled: '취소',
}
export const dateText = (value?: string | null) => value ? value.slice(0, 10).replaceAll('-', '.') : '확인 불가'
