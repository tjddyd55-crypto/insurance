export const isoDate = (v) => v ? String(v).slice(0, 10) : null
export function shiftMonths(date, months) {
  const d = new Date(`${date}T00:00:00Z`), day = d.getUTCDate()
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months)
  const max = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, max)); return d.toISOString().slice(0, 10)
}
export function sourceCoverage(records, asOf) {
  return ['2001', '2002', '2004', '1004', '1010'].map((datasetCode) => {
    const dates = records.filter((r) => r.datasetCode === datasetCode).map((r) => isoDate(r.date)).filter(Boolean).sort()
    // SDK technical guide v2.0: PG-SDK-0206 p133, lines 6480–6481: 10 years returned.
    // PG-SDK-0207 pp134–135, lines 6541–6543 & 6567–6575: -14 .. -2 months, max 1 year.
    // PG-SDK-0219 pp137–138, lines 6673–6760: no guaranteed period; use received-data only.
    const official = datasetCode === '2001' || datasetCode === '2002'
    const availableFrom = datasetCode === '2001' ? shiftMonths(asOf, -120) : datasetCode === '2002' ? shiftMonths(asOf, -14) : dates[0] || null
    const availableTo = datasetCode === '2001' ? asOf : datasetCode === '2002' ? shiftMonths(asOf, -2) : dates.at(-1) || null
    return { source: datasetCode.startsWith('1') ? 'MEDICAL_INSTITUTION' : datasetCode === '2004' ? 'HIRA_PUBLIC' : 'NHIS_PUBLIC',
      datasetCode, availableFrom, availableTo, retrievalRange: { from: availableFrom, to: availableTo },
      basis: official ? 'official-rule' : 'received-data', basisLabel: official ? '공식 조회 규칙' : '수신 데이터 기준 (연속 기간의 완전성 미확인)',
      completeness: official ? 'official-window' : 'received-only', receivedFrom: dates[0] || null, receivedTo: dates.at(-1) || null,
      offlineAsOfDate: asOf, offlineLabel: '오프라인 샘플 기준일', hasData: dates.length > 0 }
  })
}
