#!/usr/bin/env node
/**
 * insurance_company_newsletter_attachments ↔ R2 정합성 점검.
 *
 * 기본(dry-run): missing object 목록만 출력.
 * --delete-missing --confirm: R2에 없는 attachment row만 DB에서 삭제(소식지 본문은 유지).
 */
import pg from 'pg'

import { insurerNewsAttachmentExistsInR2 } from '../server/lib/insurerNewsAttachmentStorage.js'

const args = new Set(process.argv.slice(2))
const deleteMissing = args.has('--delete-missing')
const confirmed = args.has('--confirm')

if (deleteMissing && !confirmed) {
  console.error('R2 missing attachment row 삭제는 --delete-missing --confirm 이 필요합니다.')
  process.exit(1)
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL 이 필요합니다.')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString })

try {
  const res = await pool.query(
    `
    SELECT
      a.id,
      a.newsletter_id,
      a.object_key,
      a.url,
      a.file_name,
      a.mime_type,
      n.company_name_snapshot,
      n.created_at,
      n.payload
    FROM insurance_company_newsletter_attachments a
    INNER JOIN insurance_company_newsletters n ON n.id = a.newsletter_id
    ORDER BY n.created_at DESC, a.sort_order ASC
    `,
  )

  /** @type {typeof res.rows} */
  const missing = []
  for (const row of res.rows) {
    const objectKey = String(row.object_key ?? '').trim()
    if (!objectKey) {
      missing.push({ ...row, reason: 'empty-object-key' })
      continue
    }
    const exists = await insurerNewsAttachmentExistsInR2(objectKey)
    if (!exists) {
      missing.push({ ...row, reason: 'r2-not-found' })
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: deleteMissing ? 'delete-missing' : 'dry-run',
        scanned: res.rowCount,
        missingCount: missing.length,
        missing: missing.map((row) => ({
          attachmentId: row.id,
          newsletterId: row.newsletter_id,
          company: row.company_name_snapshot,
          createdAt: row.created_at,
          objectKey: row.object_key,
          url: row.url,
          fileName: row.file_name,
          reason: row.reason,
        })),
      },
      null,
      2,
    ),
  )

  if (deleteMissing && missing.length > 0) {
    for (const row of missing) {
      await pool.query(`DELETE FROM insurance_company_newsletter_attachments WHERE id = $1`, [row.id])
    }
    console.log(`deleted attachment rows: ${missing.length}`)
  }
} finally {
  await pool.end()
}
