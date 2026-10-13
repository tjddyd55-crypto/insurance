const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100

/**
 * @param {import('express').Request['query']} query
 */
export function parsePublicGaGroupGasPagination(query) {
  const limitRaw = Number(query?.limit)
  const offsetRaw = Number(query?.offset)
  const limit = Math.min(
    Math.max(Number.isFinite(limitRaw) ? Math.floor(limitRaw) : DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  )
  const offset = Math.max(Number.isFinite(offsetRaw) ? Math.floor(offsetRaw) : 0, 0)
  return { limit, offset }
}

export { DEFAULT_LIMIT as PUBLIC_GA_GROUP_GAS_DEFAULT_LIMIT, MAX_LIMIT as PUBLIC_GA_GROUP_GAS_MAX_LIMIT }
