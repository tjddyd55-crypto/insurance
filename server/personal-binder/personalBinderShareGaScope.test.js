import assert from 'node:assert/strict'
import test from 'node:test'

import { sqlHasTenantGaFilter } from '../utils/dbSafeQuery.js'

const SHARE_CHILD_INSERTS = [
  `INSERT INTO personal_binder_ga_share_files (
    share_id, ga_id, object_key, material_title, original_file_name,
    mime_type, file_size, page_count, checksum_sha256,
    source_material_id, source_file_id
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
  `INSERT INTO personal_binder_ga_share_sections (share_id, ga_id, title, sort_order) VALUES ($1, $2, $3, $4)`,
  `INSERT INTO personal_binder_ga_share_items (
    share_section_id, share_file_id, ga_id, sort_order, page_selection
  ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
  `UPDATE personal_binder_ga_shares SET status = 'active' WHERE id = $4 AND ga_id = $5`,
  `SELECT object_key FROM personal_binder_ga_share_files WHERE id = $1 AND share_id = $2 AND ga_id = $3`,
  `INSERT INTO personal_binder_sections (binder_id, title, sort_order)
        SELECT $1, $2, $3
        FROM personal_binders b
        WHERE b.id = $1 AND b.owner_user_id = $4 AND b.ga_id = $5`,
  `INSERT INTO personal_binder_items (section_id, material_id, sort_order, page_selection)
          SELECT $1, $2, $3, $4::jsonb
          FROM personal_binder_sections s
          INNER JOIN personal_binders b ON b.id = s.binder_id
          WHERE s.id = $1 AND b.owner_user_id = $5 AND b.ga_id = $6`,
]

test('공유 하위 DML SQL은 ga_id 테넌트 필터를 포함한다', () => {
  for (const sql of SHARE_CHILD_INSERTS) {
    assert.equal(sqlHasTenantGaFilter(sql), true, sql.slice(0, 80))
  }
})

test('ga_id 없는 INSERT는 safeQuery에서 거부된다', () => {
  const blocked = `INSERT INTO personal_binder_ga_share_files (share_id, object_key) VALUES ($1, $2)`
  assert.equal(sqlHasTenantGaFilter(blocked), false)
})
