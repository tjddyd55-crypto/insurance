import { safeQuery } from '../utils/dbSafeQuery.js'

export const RELATION_GROUP_TYPES = Object.freeze(['FAMILY', 'BUSINESS', 'ETC'])
export const DEFAULT_RELATIONSHIP_LABELS = Object.freeze([
  '본인',
  '배우자',
  '아버지',
  '어머니',
  '자녀',
  '형제',
  '기타',
])

/**
 * @param {unknown} raw
 * @returns {'FAMILY' | 'BUSINESS' | 'ETC'}
 */
export function normalizeGroupType(raw) {
  const value = String(raw ?? 'FAMILY').trim().toUpperCase()
  if (RELATION_GROUP_TYPES.includes(value)) {
    return /** @type {'FAMILY' | 'BUSINESS' | 'ETC'} */ (value)
  }
  return 'FAMILY'
}

/**
 * @param {unknown} raw
 * @param {string} [fallback]
 */
export function normalizeRelationshipLabel(raw, fallback = '') {
  const value = String(raw ?? '').trim()
  if (!value) {
    return fallback
  }
  return value.slice(0, 40)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{ customerId: number, userId: string, gaId: number }} args
 */
export async function findActiveFamilyGroupForCustomer(db, { customerId, userId, gaId }) {
  const r = await safeQuery(
    db,
    `
    SELECT g.id, g.name
    FROM customer_relation_group_members m
    INNER JOIN customer_relation_groups g
      ON g.id = m.group_id
     AND g.deleted_at IS NULL
     AND g.user_id = $2
     AND g.ga_id = $3
     AND g.group_type = 'FAMILY'
    WHERE m.customer_id = $1
      AND m.deleted_at IS NULL
    LIMIT 1
    `,
    [customerId, userId, gaId],
  )
  const row = r.rows[0]
  if (!row) {
    return null
  }
  return { id: Number(row.id), name: String(row.name ?? '') }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{ groupId: number, userId: string, gaId: number }} args
 */
export async function getOwnedActiveGroup(db, { groupId, userId, gaId }) {
  const r = await safeQuery(
    db,
    `
    SELECT id, name, group_type, memo, user_id, ga_id, created_at, updated_at
    FROM customer_relation_groups
    WHERE id = $1 AND user_id = $2 AND ga_id = $3 AND deleted_at IS NULL
    `,
    [groupId, userId, gaId],
  )
  return r.rows[0] ?? null
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{ groupId: number, currentCustomerId: number }} args
 */
export async function listActiveGroupMembers(db, { groupId, currentCustomerId }) {
  const r = await safeQuery(
    db,
    `
    SELECT
      m.customer_id,
      m.relationship_label,
      m.sort_order,
      c.name AS customer_name,
      c.phone AS customer_phone
    FROM customer_relation_group_members m
    INNER JOIN customers c
      ON c.id = m.customer_id
     AND c.deleted_at IS NULL
    WHERE m.group_id = $1
      AND m.deleted_at IS NULL
    ORDER BY m.sort_order ASC, m.id ASC
    `,
    [groupId],
  )
  return r.rows.map((row) => {
    const customerId = Number(row.customer_id)
    return {
      customerId,
      name: String(row.customer_name ?? ''),
      phone: String(row.customer_phone ?? ''),
      relationshipLabel: row.relationship_label ? String(row.relationship_label) : '',
      isCurrentCustomer: customerId === currentCustomerId,
      sortOrder: Number(row.sort_order) || 0,
    }
  })
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{ customerId: number, userId: string, gaId: number }} args
 */
export async function listRelationGroupsForCustomer(db, { customerId, userId, gaId }) {
  const groupsResult = await safeQuery(
    db,
    `
    SELECT g.id, g.name, g.group_type, g.memo, g.created_at, g.updated_at
    FROM customer_relation_groups g
    INNER JOIN customer_relation_group_members m
      ON m.group_id = g.id
     AND m.customer_id = $1
     AND m.deleted_at IS NULL
    WHERE g.user_id = $2
      AND g.ga_id = $3
      AND g.deleted_at IS NULL
    ORDER BY g.updated_at DESC, g.id DESC
    `,
    [customerId, userId, gaId],
  )

  const out = []
  for (const row of groupsResult.rows) {
    const groupId = Number(row.id)
    const members = await listActiveGroupMembers(db, { groupId, currentCustomerId: customerId })
    out.push({
      id: groupId,
      name: String(row.name ?? ''),
      groupType: String(row.group_type ?? 'FAMILY'),
      memo: row.memo == null ? '' : String(row.memo),
      members,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : '',
    })
  }
  return out
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{
 *   customerId: number,
 *   userId: string,
 *   gaId: number,
 *   name: string,
 *   groupType?: string,
 *   memo?: string,
 *   members?: Array<{ customerId: number, relationshipLabel?: string }>,
 * }} args
 */
export async function createRelationGroup(client, args) {
  const {
    customerId,
    userId,
    gaId,
    name,
    groupType = 'FAMILY',
    memo = '',
    members = [],
  } = args

  const normalizedType = normalizeGroupType(groupType)
  const groupName = String(name ?? '').trim().slice(0, 80)
  if (!groupName) {
    return { ok: false, status: 400, message: '그룹명을 입력해 주세요.' }
  }

  if (normalizedType === 'FAMILY') {
    const existing = await findActiveFamilyGroupForCustomer(client, { customerId, userId, gaId })
    if (existing) {
      return {
        ok: false,
        status: 409,
        code: 'already_in_family_group',
        message: `이미 가족 그룹에 포함된 고객입니다.`,
        data: { existingGroupId: existing.id, existingGroupName: existing.name },
      }
    }
  }

  /** @type {Map<number, string>} */
  const memberMap = new Map()
  memberMap.set(customerId, '본인')
  for (const item of members) {
    const id = Number(item?.customerId)
    if (!Number.isInteger(id) || id < 1 || id === customerId) {
      continue
    }
    if (memberMap.has(id)) {
      continue
    }
    memberMap.set(id, normalizeRelationshipLabel(item?.relationshipLabel, '기타') || '기타')
  }

  for (const [memberId] of memberMap) {
    if (memberId === customerId) {
      continue
    }
    if (normalizedType === 'FAMILY') {
      const existing = await findActiveFamilyGroupForCustomer(client, {
        customerId: memberId,
        userId,
        gaId,
      })
      if (existing) {
        return {
          ok: false,
          status: 409,
          code: 'already_in_family_group',
          message: `이미 가족 그룹에 포함된 고객입니다.`,
          data: {
            customerId: memberId,
            existingGroupId: existing.id,
            existingGroupName: existing.name,
          },
        }
      }
    }
  }

  const inserted = await client.query(
    `
    INSERT INTO customer_relation_groups (ga_id, user_id, name, group_type, memo, created_by)
    VALUES ($1, $2, $3, $4, $5, $2)
    RETURNING id, name, group_type, memo, created_at, updated_at
    `,
    [gaId, userId, groupName, normalizedType, String(memo ?? '').trim().slice(0, 500) || null],
  )
  const groupRow = inserted.rows[0]
  const groupId = Number(groupRow.id)

  let sortOrder = 0
  for (const [memberId, label] of memberMap) {
    await client.query(
      `
      INSERT INTO customer_relation_group_members
        (group_id, customer_id, relationship_label, sort_order)
      VALUES ($1, $2, $3, $4)
      `,
      [groupId, memberId, label || null, sortOrder],
    )
    sortOrder += 1
  }

  const membersOut = await listActiveGroupMembers(client, { groupId, currentCustomerId: customerId })
  return {
    ok: true,
    data: {
      id: groupId,
      name: String(groupRow.name ?? groupName),
      groupType: String(groupRow.group_type ?? normalizedType),
      memo: groupRow.memo == null ? '' : String(groupRow.memo),
      members: membersOut,
      createdAt: groupRow.created_at ? new Date(groupRow.created_at).toISOString() : '',
      updatedAt: groupRow.updated_at ? new Date(groupRow.updated_at).toISOString() : '',
    },
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{ groupId: number, userId: string, gaId: number, name?: string, groupType?: string, memo?: string }} args
 */
export async function updateRelationGroup(db, args) {
  const group = await getOwnedActiveGroup(db, {
    groupId: args.groupId,
    userId: args.userId,
    gaId: args.gaId,
  })
  if (!group) {
    return { ok: false, status: 404, message: '그룹을 찾을 수 없습니다.' }
  }

  const nextName =
    args.name !== undefined ? String(args.name ?? '').trim().slice(0, 80) : String(group.name ?? '')
  if (!nextName) {
    return { ok: false, status: 400, message: '그룹명을 입력해 주세요.' }
  }
  const nextType =
    args.groupType !== undefined ? normalizeGroupType(args.groupType) : String(group.group_type)
  const nextMemo =
    args.memo !== undefined
      ? String(args.memo ?? '').trim().slice(0, 500) || null
      : group.memo == null
        ? null
        : String(group.memo)

  const r = await safeQuery(
    db,
    `
    UPDATE customer_relation_groups
    SET name = $1,
        group_type = $2,
        memo = $3,
        updated_at = NOW()
    WHERE id = $4 AND user_id = $5 AND ga_id = $6 AND deleted_at IS NULL
    RETURNING id, name, group_type, memo, created_at, updated_at
    `,
    [nextName, nextType, nextMemo, args.groupId, args.userId, args.gaId],
  )
  const row = r.rows[0]
  return {
    ok: true,
    data: {
      id: Number(row.id),
      name: String(row.name ?? ''),
      groupType: String(row.group_type ?? 'FAMILY'),
      memo: row.memo == null ? '' : String(row.memo),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : '',
    },
  }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{
 *   groupId: number,
 *   userId: string,
 *   gaId: number,
 *   customerId: number,
 *   relationshipLabel?: string,
 * }} args
 */
export async function addRelationGroupMember(client, args) {
  const group = await getOwnedActiveGroup(client, {
    groupId: args.groupId,
    userId: args.userId,
    gaId: args.gaId,
  })
  if (!group) {
    return { ok: false, status: 404, message: '그룹을 찾을 수 없습니다.' }
  }

  const customerId = Number(args.customerId)
  if (!Number.isInteger(customerId) || customerId < 1) {
    return { ok: false, status: 400, message: '고객 ID가 올바르지 않습니다.' }
  }

  const existingInGroup = await safeQuery(
    client,
    `
    SELECT id FROM customer_relation_group_members
    WHERE group_id = $1 AND customer_id = $2 AND deleted_at IS NULL
    LIMIT 1
    `,
    [args.groupId, customerId],
  )
  if (existingInGroup.rowCount > 0) {
    return { ok: false, status: 409, message: '이미 이 그룹에 포함된 고객입니다.' }
  }

  if (String(group.group_type) === 'FAMILY') {
    const other = await findActiveFamilyGroupForCustomer(client, {
      customerId,
      userId: args.userId,
      gaId: args.gaId,
    })
    if (other) {
      return {
        ok: false,
        status: 409,
        code: 'already_in_family_group',
        message: '이미 가족 그룹에 포함된 고객입니다.',
        data: { existingGroupId: other.id, existingGroupName: other.name },
      }
    }
  }

  const maxSort = await safeQuery(
    client,
    `
    SELECT COALESCE(MAX(sort_order), -1) AS max_sort
    FROM customer_relation_group_members
    WHERE group_id = $1 AND deleted_at IS NULL
    `,
    [args.groupId],
  )
  const sortOrder = Number(maxSort.rows[0]?.max_sort ?? -1) + 1
  const label = normalizeRelationshipLabel(args.relationshipLabel, '기타') || '기타'

  await client.query(
    `
    INSERT INTO customer_relation_group_members
      (group_id, customer_id, relationship_label, sort_order)
    VALUES ($1, $2, $3, $4)
    `,
    [args.groupId, customerId, label, sortOrder],
  )
  await client.query(
    `UPDATE customer_relation_groups SET updated_at = NOW() WHERE id = $1`,
    [args.groupId],
  )

  return { ok: true }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{ groupId: number, userId: string, gaId: number, customerId: number, relationshipLabel: string }} args
 */
export async function updateRelationGroupMemberLabel(db, args) {
  const group = await getOwnedActiveGroup(db, {
    groupId: args.groupId,
    userId: args.userId,
    gaId: args.gaId,
  })
  if (!group) {
    return { ok: false, status: 404, message: '그룹을 찾을 수 없습니다.' }
  }
  const label = normalizeRelationshipLabel(args.relationshipLabel, '')
  if (!label) {
    return { ok: false, status: 400, message: '관계 라벨을 입력해 주세요.' }
  }
  const r = await safeQuery(
    db,
    `
    UPDATE customer_relation_group_members
    SET relationship_label = $1, updated_at = NOW()
    WHERE group_id = $2 AND customer_id = $3 AND deleted_at IS NULL
    RETURNING id
    `,
    [label, args.groupId, args.customerId],
  )
  if (r.rowCount === 0) {
    return { ok: false, status: 404, message: '그룹 구성원을 찾을 수 없습니다.' }
  }
  await safeQuery(db, `UPDATE customer_relation_groups SET updated_at = NOW() WHERE id = $1`, [
    args.groupId,
  ])
  return { ok: true, data: { relationshipLabel: label } }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ groupId: number, userId: string, gaId: number, customerId: number }} args
 */
export async function removeRelationGroupMember(client, args) {
  const group = await getOwnedActiveGroup(client, {
    groupId: args.groupId,
    userId: args.userId,
    gaId: args.gaId,
  })
  if (!group) {
    return { ok: false, status: 404, message: '그룹을 찾을 수 없습니다.' }
  }

  const del = await client.query(
    `
    UPDATE customer_relation_group_members
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE group_id = $1 AND customer_id = $2 AND deleted_at IS NULL
    RETURNING id
    `,
    [args.groupId, args.customerId],
  )
  if (del.rowCount === 0) {
    return { ok: false, status: 404, message: '그룹 구성원을 찾을 수 없습니다.' }
  }

  const remaining = await client.query(
    `
    SELECT COUNT(*)::int AS cnt
    FROM customer_relation_group_members
    WHERE group_id = $1 AND deleted_at IS NULL
    `,
    [args.groupId],
  )
  const count = Number(remaining.rows[0]?.cnt ?? 0)
  if (count <= 1) {
    await softDeleteRelationGroup(client, {
      groupId: args.groupId,
      userId: args.userId,
      gaId: args.gaId,
    })
    return { ok: true, data: { groupDeleted: true, remainingMembers: 0 } }
  }

  await client.query(`UPDATE customer_relation_groups SET updated_at = NOW() WHERE id = $1`, [
    args.groupId,
  ])
  return { ok: true, data: { groupDeleted: false, remainingMembers: count } }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{ groupId: number, userId: string, gaId: number }} args
 */
export async function softDeleteRelationGroup(db, args) {
  const group = await getOwnedActiveGroup(db, args)
  if (!group) {
    return { ok: false, status: 404, message: '그룹을 찾을 수 없습니다.' }
  }
  await safeQuery(
    db,
    `
    UPDATE customer_relation_group_members
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE group_id = $1 AND deleted_at IS NULL
    `,
    [args.groupId],
  )
  await safeQuery(
    db,
    `
    UPDATE customer_relation_groups
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND user_id = $2 AND ga_id = $3 AND deleted_at IS NULL
    `,
    [args.groupId, args.userId, args.gaId],
  )
  return { ok: true }
}
