import type { CoverageScenarioItem } from './types'

/** 항목 표시명 SSOT — Viewer/PDF/Editor 모두 이 값만 사용한다. */
export function resolveCoverageDisplayTitle(item: CoverageScenarioItem): string {
  const label = String(item.label ?? '').trim()
  return label || '보장 항목'
}
