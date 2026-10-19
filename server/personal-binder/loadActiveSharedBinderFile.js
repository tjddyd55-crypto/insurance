import { safeQuery } from '../utils/dbSafeQuery.js'

/**
 * 공유 스냅샷 파일 1개. 기존 공유 접근 규칙(personalBinderShareService.assertActiveShareAccess)과 같다:
 * 같은 GA 이고 공유 status = 'active' 일 때만. 해제(revoked)·생성 중(creating)·다른 GA 는 null(404).
 * 렌더 파이프라인이 읽는 컬럼 이름(file_path·file_size·page_count·checksum_sha256)으로 맞춘다.
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ userId: string, gaId: number }} scope
 */
export async function loadActiveSharedBinderFile(executor, scope, shareId, shareFileId) {
  const result = await safeQuery(
    executor,
    `
    SELECT
      f.id AS share_file_id,
      f.share_id,
      f.object_key AS file_path,
      f.mime_type AS file_mime,
      f.file_size,
      f.page_count,
      f.checksum_sha256
    FROM personal_binder_ga_share_files f
    INNER JOIN personal_binder_ga_shares s
      ON s.id = f.share_id AND s.ga_id = f.ga_id
    WHERE f.id = $1
      AND f.share_id = $2
      AND f.ga_id = $3
      AND s.status = 'active'
    LIMIT 1
    `,
    [shareFileId, shareId, scope.gaId],
  )
  return result.rows[0] ?? null
}
