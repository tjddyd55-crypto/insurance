export function buildCoveragePdfFileNameFromScenario(scenario) {
  const customer =
    scenario?.customerNameSnapshot != null
      ? String(scenario.customerNameSnapshot).trim()
      : scenario?.customerName != null
        ? String(scenario.customerName).trim()
        : ''
  const disease = String(scenario?.title ?? scenario?.diseaseType ?? '보장시뮬레이션')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '')
  const date = String(scenario?.consultationDate ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10)
  const parts = [customer ? customer.replace(/\s+/g, '') : null, disease || '보장시뮬레이션', '보장시뮬레이션', date].filter(Boolean)
  return `${parts.join('_')}.pdf`
}
