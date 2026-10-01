import { resolveCustomerNameSnapshot } from '../domain/normalizeConsultation'
import type { CoverageScenario } from '../domain/types'

const INVALID_FILE_NAME_CHARS = new Set(['\\', '/', ':', '*', '?', '"', '<', '>', '|'])
const MAX_FILE_NAME_PART_LENGTH = 40
const SIMULATION_NAME_FALLBACK = '보장시뮬레이션'

function isInvalidFileNameChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0
  if (code <= 0x1f || code === 0x7f) return true
  return INVALID_FILE_NAME_CHARS.has(char)
}

function sanitizeFilePart(value: string): string {
  const stripped = Array.from(value).filter((char) => !isInvalidFileNameChar(char)).join('')
  const collapsed = stripped.replace(/\s+/g, ' ').trim()
  return Array.from(collapsed).slice(0, MAX_FILE_NAME_PART_LENGTH).join('')
}

/**
 * `고객명_시뮬레이션이름.pdf`. 고객이 없으면 `시뮬레이션이름.pdf`.
 * 시뮬레이션 이름은 scenario.title. 날짜·질병 라벨은 넣지 않는다.
 */
export function buildCoveragePdfFileName(scenario: CoverageScenario): string {
  const customer = sanitizeFilePart(resolveCustomerNameSnapshot(scenario) ?? '')
  const simulation = sanitizeFilePart(scenario.title ?? '')
  const parts = [customer, simulation].filter(Boolean)
  if (parts.length === 0) return `${SIMULATION_NAME_FALLBACK}.pdf`
  return `${parts.join('_')}.pdf`
}
