export function normalizeKcd(value) {
  const raw = String(value || '').toUpperCase().replace(/[\s.]/g, '')
  return /^[A-Z]\d{2}[A-Z\d]*$/.test(raw) ? raw.slice(0, 3) + (raw.length > 3 ? `.${raw.slice(3)}` : '') : raw
}
export function lookupKcd(raw, sourceDisplay, master = []) {
  const code = normalizeKcd(raw)
  const entry = master.find((m) => m.active !== false && normalizeKcd(m.code_normalized || m.code_raw) === code)
  const name = entry?.korean_name || sourceDisplay || '코드 확인 필요'
  return { raw, code, name, display: `${code} · ${name}`, nameBasis: entry?.korean_name ? 'official-master' : sourceDisplay ? '원본 표시명' : 'unmapped',
    parentCode: entry?.parent_code || null, diseaseGroup: entry?.disease_group || null }
}
export function searchKcd(master, query) {
  const normalized = normalizeKcd(query)
  return master.filter((m) => m.active !== false && (normalizeKcd(m.code_normalized || m.code_raw).includes(normalized) || m.korean_name?.includes(query)))
}
export function diseaseGroupFor(record, master, groups = []) {
  if (!record.kcdCodeRaw) return null
  const kcd = lookupKcd(record.kcdCodeRaw, record.sourceDisplay, master)
  const parent = master.find((m) => normalizeKcd(m.code_normalized || m.code_raw) === normalizeKcd(kcd.parentCode) && m.active !== false)
  return { exact: kcd.code, parent: parent?.code_normalized || null,
    admin: kcd.diseaseGroup || parent?.disease_group || groups.find((g) => g.active !== false && g.codes?.map(normalizeKcd).includes(kcd.code))?.group_code || null }
}
// Public EOB identifiers lack an authoritative system; medical sample serviceProvider Organization is missing.
// No shared Encounter/claim identifier is documented between these profiles. Never mark a candidate confirmed.
export function diagnosisCandidates(visit, conditions) {
  return conditions.filter((r) => r.kcdCodeRaw && ((visit.date && isoDay(r.encounterPeriod?.start || r.date) === isoDay(visit.date)) ||
    (visit.institution?.name && r.institution?.name === visit.institution.name))).map((r) => ({ evidenceId: r.id, relationship: 'candidate', label: '관련 진단 후보' }))
}
function isoDay(value) { return value ? value.slice(0, 10) : null }
