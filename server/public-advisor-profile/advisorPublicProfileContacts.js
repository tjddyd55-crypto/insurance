import { systemQuery } from '../utils/dbSafeQuery.js'

export const CUSTOM_CONTACTS_MAX = 8

const CONTACT_TYPES = new Set(['phone', 'email', 'url', 'text'])

export function normalizeContactType(value) {
  const t = String(value ?? 'text').trim().toLowerCase()
  return CONTACT_TYPES.has(t) ? t : 'text'
}

export async function loadCustomContacts(pool, userId) {
  const r = await systemQuery(
    pool,
    `
    SELECT id, label, value, contact_type, is_visible, sort_order
    FROM advisor_public_profile_contacts
    WHERE user_id = $1
    ORDER BY sort_order ASC, created_at ASC
    `,
    [userId],
  )
  return r.rows
}

export async function loadVisibleCustomContacts(pool, userId) {
  const rows = await loadCustomContacts(pool, userId)
  return rows.filter((row) => row.is_visible !== false)
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} userId
 * @param {Array<{ id?: string, label?: string, value?: string, contact_type?: string, is_visible?: boolean, sort_order?: number }>} items
 */
export async function syncCustomContacts(pool, userId, items) {
  const list = Array.isArray(items) ? items.slice(0, CUSTOM_CONTACTS_MAX) : []
  await systemQuery(pool, `DELETE FROM advisor_public_profile_contacts WHERE user_id = $1`, [userId])
  let order = 0
  for (const item of list) {
    const label = String(item.label ?? '').trim().slice(0, 80)
    const value = String(item.value ?? '').trim().slice(0, 500)
    if (!label || !value) continue
    await systemQuery(
      pool,
      `
      INSERT INTO advisor_public_profile_contacts (user_id, label, value, contact_type, is_visible, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        userId,
        label,
        value,
        normalizeContactType(item.contact_type),
        item.is_visible !== false,
        Number.isFinite(item.sort_order) ? item.sort_order : order,
      ],
    )
    order += 1
  }
}
