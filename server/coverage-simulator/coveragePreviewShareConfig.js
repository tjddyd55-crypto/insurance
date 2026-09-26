export function isCoveragePreviewShareApiEnabled() {
  if (process.env.ENABLE_COVERAGE_PREVIEW_SHARE === '0') return false
  if (process.env.ENABLE_COVERAGE_PREVIEW_SHARE === '1') return true
  return process.env.NODE_ENV !== 'production'
}

export function resolvePreviewShareOwnerFromEnv() {
  const gaId = Number.parseInt(String(process.env.COVERAGE_PREVIEW_SHARE_GA_ID ?? ''), 10)
  const userId = String(process.env.COVERAGE_PREVIEW_SHARE_USER_ID ?? '').trim()
  if (!Number.isFinite(gaId) || gaId <= 0 || !userId) {
    return null
  }
  return { gaId, userId }
}
