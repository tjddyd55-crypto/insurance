import { isoDate } from './coverage.js'
import { diseaseGroupFor } from './kcd.js'
const DAY = 86_400_000
const epoch = (date) => { const n = Date.parse(`${isoDate(date)}T00:00:00Z`); return Number.isFinite(n) ? n / DAY : null }
export const STATUS_LABELS = { DETECTED: '확인 필요', NOT_DETECTED: '특이사항 없음', INSUFFICIENT_DATA: '데이터 부족', UNSUPPORTED: '현재 조회 불가' }
export const DEFAULT_RULES = [
  { rule_code: 'VISIT_3M', name: '3개월 진료', rule_type: 'visit', lookback_days: 90, min_visit_days: 1, required_sources: ['2002'] },
  { rule_code: 'REPEAT_1Y', name: '1년 반복 진료', rule_type: 'repeat', lookback_days: 365, min_visit_days: 3, required_sources: ['2002'] },
  { rule_code: 'TREATMENT_7D', name: '7일 이상 치료 가능성', rule_type: 'treatment', lookback_days: 365, min_visit_days: 7, required_sources: ['2002'] },
  { rule_code: 'MEDICATION_30D', name: '30일 이상 투약 가능성', rule_type: 'medication', lookback_days: 365, min_medication_days: 30, required_sources: ['2004'] },
  { rule_code: 'ADMISSION', name: '입원 여부', rule_type: 'hospitalization', lookback_days: 365, required_sources: ['2002'] },
  { rule_code: 'SURGERY', name: '수술 여부', rule_type: 'surgery', lookback_days: 1825, required_sources: ['1010'] },
  { rule_code: 'REPEAT_5Y', name: '5년 반복 진료', rule_type: 'repeat', lookback_days: 1825, min_visit_days: 3, required_sources: ['2002'] },
].map((r) => ({ enabled: true, version: 'offline-dev-1', disease_group: null, ...r }))
export function unionDays(intervals) {
  const sorted = intervals.filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b >= a).sort((a, b) => a[0] - b[0])
  let start = null, end = null, days = 0
  for (const [a, b] of sorted) {
    if (start == null) { start = a; end = b }
    else if (a <= end + 1) end = Math.max(end, b)
    else { days += end - start + 1; start = a; end = b }
  }
  return days + (start == null ? 0 : end - start + 1)
}
export function medicationIntervals(records, from = -Infinity, to = Infinity) {
  const groups = new Map()
  for (const r of records.filter((r) => r.kind === 'dispense' && r.drugCodeRaw)) {
    const key = `${r.drugCodeSystem || ''}|${r.drugCodeRaw}`
    const group = groups.get(key) || { key, intervals: [], estimatedDays: 0, estimated: false, evidenceIds: [] }
    const start = epoch(r.date), days = Number(r.daysSupply)
    if (!(days > 0)) continue
    if (start == null) { group.estimated = true; group.estimatedDays += days; group.evidenceIds.push(r.id) }
    else if (start <= to && start + days - 1 >= from) {
      group.intervals.push([Math.max(start, from), Math.min(start + days - 1, to)]); group.evidenceIds.push(r.id)
    }
    groups.set(key, group)
  }
  return [...groups.values()].map((g) => ({ ...g, days: unionDays(g.intervals) + g.estimatedDays }))
}
function sufficient(coverage, datasets, from, to) {
  return datasets.every((code) => coverage.some((c) => c.datasetCode === code && c.hasData &&
    c.completeness !== 'received-only' && epoch(c.availableFrom) != null && epoch(c.availableTo) != null && epoch(c.availableFrom) <= from && epoch(c.availableTo) >= to))
}
export function analyze({ records, coverage, asOf, rules = DEFAULT_RULES, kcdMaster = [], diseaseGroups = [] }) {
  const to = epoch(asOf)
  return rules.filter((r) => r.enabled).map((rule) => {
    const from = to - rule.lookback_days + 1
    const datasetCodes = rule.required_sources || []
    const rows = records.filter((r) => datasetCodes.includes(r.datasetCode) && epoch(r.date) != null && epoch(r.date) >= from && epoch(r.date) <= to)
    let status = 'NOT_DETECTED', evidenceIds = [], estimated = false, count = 0, note = ''
    const procedureAvailable = records.some((r) => r.datasetCode === '1010') || coverage.some((c) => c.datasetCode === '1010' && c.hasData)
    if (rule.rule_type === 'surgery' && !procedureAvailable) { status = 'UNSUPPORTED'; note = '공공데이터만으로는 확인 불가' }
    else {
      switch (rule.rule_type) {
        case 'visit': evidenceIds = rows.filter((r) => r.kind === 'visit' || r.kind === 'condition').map((r) => r.id); count = evidenceIds.length; break
        case 'repeat': {
          const groups = new Map()
          for (const row of rows) {
            const disease = diseaseGroupFor(row, kcdMaster, diseaseGroups)
            if (rule.disease_group && ![disease?.exact, disease?.parent, disease?.admin].includes(rule.disease_group)) continue
            if (!disease && row.kind !== 'visit') continue
            const keys = disease ? (rule.disease_group ? [`0:${rule.disease_group}`] :
              [`0:${disease.exact}`, ...(disease.parent ? [`1:${disease.parent}`] : []), ...(disease.admin ? [`2:${disease.admin}`] : [])]) :
              [`0:${JSON.stringify([row.institution?.identifiers || [], row.institution?.name, row.visitType])}`]
            for (const key of keys) { const group = groups.get(key) || []; group.push(row); groups.set(key, group) }
          }
          const rank = (group) => new Set(group.map((r) => isoDate(r.date))).size
          const candidates = [...groups.entries()].sort((a, b) => a[0][0].localeCompare(b[0][0]) || rank(b[1]) - rank(a[1]))
          const winner = (candidates.find(([, g]) => rank(g) >= rule.min_visit_days) || candidates[0])?.[1] || []
          count = rank(winner); evidenceIds = winner.map((r) => r.id)
          note = winner.some((r) => r.kcdCodeRaw) ? '공식 KCD/설정 그룹 기준' : '동일 기관·진료형태 반복 (질환 반복으로 확정하지 않음)'; break
        }
        case 'treatment': {
          const hit = rows.filter((r) => Math.max(Number(r.visitHospitalDays || 0), Number(r.treatmentDays || 0),
            r.encounterPeriod?.end ? epoch(r.encounterPeriod.end) - epoch(r.encounterPeriod.start) + 1 : 0) >= rule.min_visit_days)
          evidenceIds = hit.map((r) => r.id); count = hit.length; estimated = hit.length > 0; note = '공식 방문입원일수·요양투약일수·내원기간에 따른 가능성'; break
        }
        case 'medication': {
          const groups = medicationIntervals(records, from, to).filter((g) => g.days >= rule.min_medication_days)
          evidenceIds = groups.flatMap((g) => g.evidenceIds); count = Math.max(0, ...groups.map((g) => g.days)); estimated = groups.some((g) => g.estimated)
          note = estimated ? '추정: 조제일 누락으로 기간 중복·발생시점 확인 필요' : '동일 원본 약품코드별 투약 구간 중복 제거'; break
        }
        case 'hospitalization': {
          const hit = rows.filter((r) => r.encounterClass?.code === 'IMP' || (r.kind === 'visit' && r.visitType === 'institutional' && r.visitHospitalDays > 0))
          evidenceIds = hit.map((r) => r.id); count = hit.length; estimated = hit.some((r) => r.encounterClass?.code !== 'IMP')
          note = estimated ? '입원 확인 후보: 방문입원일수는 외래 방문도 포함하므로 입원 확정 불가' : 'Encounter class IMP'; break
        }
        case 'surgery': evidenceIds = rows.filter((r) => r.kind === 'procedure' && r.status === 'completed').map((r) => r.id); count = evidenceIds.length; note = '1010은 수술 및 처치: 원본 코드 확인 필요'; break
        default: status = 'UNSUPPORTED'; note = '지원하지 않는 규칙 유형'
      }
      if (status !== 'UNSUPPORTED') {
        status = evidenceIds.length && (rule.rule_type !== 'repeat' && rule.rule_type !== 'visit' || count >= rule.min_visit_days) ? 'DETECTED' : 'NOT_DETECTED'
        if (!sufficient(coverage, datasetCodes, from, to)) { status = 'INSUFFICIENT_DATA'; note = `${note ? `${note}. ` : ''}요구 기간 전체가 확보되지 않았습니다.` }
      }
    }
    return { ruleCode: rule.rule_code, name: rule.name, ruleVersion: rule.version, analysisRuleVersion: rule.version,
      status, statusLabel: STATUS_LABELS[status], evidenceIds: [...new Set(evidenceIds)], count, estimated, note,
      window: { from: new Date(from * DAY).toISOString().slice(0, 10), to: asOf }, label: '고지 확인 후보' }
  })
}
