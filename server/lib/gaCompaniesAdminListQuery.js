const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

/**
 * @param {Record<string, unknown>} query
 */
export function parseGaCompaniesAdminListParams(query) {
  const pageRaw = Number.parseInt(String(query?.page ?? '1'), 10)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  const sizeRaw = Number.parseInt(String(query?.pageSize ?? query?.limit ?? DEFAULT_PAGE_SIZE), 10)
  const pageSize =
    Number.isFinite(sizeRaw) && sizeRaw > 0 ? Math.min(sizeRaw, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE

  const q = String(query?.q ?? '').trim()

  let groupFilter = 'all'
  const ungroupedFlag = String(query?.ungrouped ?? '').toLowerCase()
  const groupFilterRaw = String(query?.groupFilter ?? query?.group_filter ?? '').trim()
  const groupIdRaw = query?.groupId ?? query?.group_id

  if (ungroupedFlag === 'true' || ungroupedFlag === '1' || groupFilterRaw === 'ungrouped') {
    groupFilter = 'ungrouped'
  } else if (groupFilterRaw && groupFilterRaw !== 'all') {
    const gid = Number.parseInt(groupFilterRaw, 10)
    if (Number.isFinite(gid) && gid > 0) {
      groupFilter = gid
    }
  } else if (groupIdRaw != null && String(groupIdRaw).trim() !== '') {
    const gid = Number.parseInt(String(groupIdRaw), 10)
    if (Number.isFinite(gid) && gid > 0) {
      groupFilter = gid
    }
  }

  const offset = (page - 1) * pageSize

  return { page, pageSize, offset, q, groupFilter }
}

/**
 * @param {{ q: string, groupFilter: 'all' | 'ungrouped' | number }} filters
 */
export function buildGaCompaniesAdminListWhere(filters) {
  const params = []
  const conditions = ['g.is_deleted = false']

  if (filters.q) {
    params.push(`%${filters.q}%`)
    const idx = params.length
    conditions.push(`(g.name ILIKE $${idx} OR g.code ILIKE $${idx})`)
  }

  if (filters.groupFilter === 'ungrouped') {
    conditions.push('m.group_id IS NULL')
  } else if (typeof filters.groupFilter === 'number') {
    params.push(filters.groupFilter)
    conditions.push(`m.group_id = $${params.length}`)
  }

  const where = conditions.join(' AND ')
  const from = `
    FROM ga_companies g
    LEFT JOIN ga_group_members m ON m.ga_id = g.id
    LEFT JOIN ga_groups gg ON gg.id = m.group_id
  `

  return { where, from, params }
}

/**
 * @param {{ q: string, groupFilter: 'all' | 'ungrouped' | number, pageSize: number, offset: number }} filters
 */
export function buildGaCompaniesAdminListQueries(filters) {
  const { where, from, params } = buildGaCompaniesAdminListWhere(filters)
  const listParams = [...params, filters.pageSize, filters.offset]
  const limitIdx = params.length + 1
  const offsetIdx = params.length + 2

  const listSql = `
    SELECT
      g.id,
      g.name,
      g.code,
      g.status,
      g.created_at,
      m.group_id,
      gg.name AS group_name
    ${from}
    WHERE ${where}
    ORDER BY g.id ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `

  const countSql = `
    SELECT COUNT(*)::int AS total
    ${from}
    WHERE ${where}
  `

  return { listSql, countSql, listParams, countParams: params }
}

/**
 * @param {unknown} row
 */
export function mapGaCompaniesAdminListRow(row) {
  return {
    id: Number(row.id),
    name: String(row.name ?? ''),
    code: String(row.code ?? ''),
    status: String(row.status ?? 'active'),
    created_at: row.created_at,
    groupId: row.group_id != null ? Number(row.group_id) : null,
    groupName: row.group_name ? String(row.group_name) : null,
  }
}
