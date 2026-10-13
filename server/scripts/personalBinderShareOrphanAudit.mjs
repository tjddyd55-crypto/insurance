/**
 * DEV: 실패·미완료 공유 스냅샷 및 R2 정리 큐 점검 (읽기 + 선택적 보상).
 * 사용: node server/scripts/personalBinderShareOrphanAudit.mjs [--apply]
 */
import pg from 'pg'

const apply = process.argv.includes('--apply')
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL required')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: databaseUrl })

async function main() {
  const stuck = await pool.query(`
    SELECT id, ga_id, title, status, created_at
    FROM personal_binder_ga_shares
    WHERE status IN ('creating', 'failed')
    ORDER BY created_at DESC
    LIMIT 50
  `)
  console.log('[stuck-shares]', stuck.rowCount)
  for (const row of stuck.rows) {
    console.log(' ', row.id, row.status, row.ga_id, row.title)
  }

  const queue = await pool.query(`
    SELECT id, object_key, reason, share_id, ga_id, retry_count, created_at
    FROM personal_binder_ga_r2_cleanup_queue
    ORDER BY created_at DESC
    LIMIT 50
  `)
  console.log('[r2-cleanup-queue]', queue.rowCount)
  for (const row of queue.rows) {
    console.log(' ', row.object_key, row.reason, row.share_id)
  }

  if (apply && queue.rowCount > 0) {
    const { compensateR2ObjectKeys } = await import(
      '../personal-binder/personalBinderShareR2Compensation.js'
    )
    for (const row of queue.rows) {
      await compensateR2ObjectKeys([row.object_key], {
        executor: pool,
        reason: 'audit_apply',
        shareId: row.share_id,
        gaId: row.ga_id,
      })
      await pool.query(`DELETE FROM personal_binder_ga_r2_cleanup_queue WHERE id = $1`, [row.id])
      console.log('[compensated]', row.object_key)
    }
  }

  await pool.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
