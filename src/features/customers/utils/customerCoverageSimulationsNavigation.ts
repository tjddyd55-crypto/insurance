/** 고객 workspace 시뮬레이션 탭 — 선택 상태 URL SSOT */
export function buildCustomerCoverageSimulationsReturnUrl(
  basePath: string,
  selection: { templateId?: string | null; simulationId?: string | null },
): string {
  const params = new URLSearchParams()
  if (selection.templateId) {
    params.set('templateId', selection.templateId)
  }
  if (selection.simulationId) {
    params.set('simulationId', selection.simulationId)
  }
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

export function parseCustomerCoverageSimulationsReturnUrl(returnTo: string): {
  pathname: string
  search: string
} {
  const url = new URL(returnTo, 'https://onefc.local')
  return { pathname: url.pathname, search: url.search }
}
