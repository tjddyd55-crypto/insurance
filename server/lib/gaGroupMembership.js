import { systemQuery } from '../utils/dbSafeQuery.js'
import { normalizeGaGroupSlug } from './gaGroupSlug.js'
import { parseGaId } from './parseGaId.js'

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ slug: string; gaId: number }} p
 */
export async function assertGaBelongsToActiveGaGroup(executor, p) {
  const slug = normalizeGaGroupSlug(p.slug)
  const gaId = parseGaId(p.gaId)
  if (!slug || gaId == null) {
    return { ok: false, message: '그룹 가입 정보가 올바르지 않습니다.' }
  }
  const r = await systemQuery(
    executor,
    `
    SELECT g.id, g.name, g.is_active
    FROM ga_groups g
    INNER JOIN ga_group_members m ON m.group_id = g.id AND m.ga_id = $2
    WHERE g.slug = $1
    LIMIT 1
    `,
    [slug, gaId],
  )
  const row = r.rows[0]
  if (!row) {
    return { ok: false, message: '선택한 지점은 이 그룹 가입 페이지에서 사용할 수 없습니다.' }
  }
  if (!row.is_active) {
    return { ok: false, message: '현재 이 그룹은 가입을 받지 않습니다.' }
  }
  return { ok: true, groupId: Number(row.id), groupName: String(row.name ?? '') }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {number} gaId
 */
export async function findGaGroupMembershipForGa(executor, gaId) {
  const gid = parseGaId(gaId)
  if (gid == null) {
    return null
  }
  const r = await systemQuery(
    executor,
    `
    SELECT m.ga_id, m.group_id, g.name AS group_name, g.slug AS group_slug
    FROM ga_group_members m
    INNER JOIN ga_groups g ON g.id = m.group_id
    WHERE m.ga_id = $1
    LIMIT 1
    `,
    [gid],
  )
  const row = r.rows[0]
  if (!row) {
    return null
  }
  return {
    gaId: gid,
    groupId: Number(row.group_id),
    groupName: String(row.group_name ?? ''),
    groupSlug: String(row.group_slug ?? ''),
  }
}
