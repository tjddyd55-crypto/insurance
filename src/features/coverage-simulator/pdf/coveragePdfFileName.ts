import { diseaseTypeTitle } from '../domain/diseaseTypeLabels'
import { resolveCustomerNameSnapshot } from '../domain/normalizeConsultation'
import type { CoverageScenario } from '../domain/types'

function sanitizeFilePart(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function formatFileDate(consultationDate: string | undefined): string {
  const raw = (consultationDate ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return raw
}

export function buildCoveragePdfFileName(scenario: CoverageScenario): string {
  const customer = resolveCustomerNameSnapshot(scenario)
  const disease = sanitizeFilePart(diseaseTypeTitle(scenario.diseaseType))
  const date = formatFileDate(scenario.consultationDate)
  const parts = [
    customer ? sanitizeFilePart(customer) : null,
    disease || '보장시뮬레이션',
    '보장시뮬레이션',
    date,
  ].filter(Boolean)
  return `${parts.join('_')}.pdf`
}
