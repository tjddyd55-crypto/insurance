/**
 * 소식지 개인 폴더 · 즐겨찾기 스키마 (additive only).
 * - 원본 소식지(insurance_company_newsletters) 는 참조만 하며 FK CASCADE 로 원본 삭제 시 링크만 정리된다.
 * - 사용자 단위(user_id) 격리. 같은 GA 다른 사용자와 공유하지 않는다.
 */
export async function ensureNewsletterCollectionsSchema(executor) {
  await executor.query(`
    CREATE TABLE IF NOT EXISTS newsletter_user_folders (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ga_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS newsletter_user_folders_owner_idx
    ON newsletter_user_folders (user_id, ga_id)
  `)
  await executor.query(`
    CREATE TABLE IF NOT EXISTS newsletter_user_folder_items (
      folder_id BIGINT NOT NULL REFERENCES newsletter_user_folders(id) ON DELETE CASCADE,
      newsletter_id TEXT NOT NULL REFERENCES insurance_company_newsletters(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (folder_id, newsletter_id)
    )
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS newsletter_user_folder_items_newsletter_idx
    ON newsletter_user_folder_items (newsletter_id)
  `)
  await executor.query(`
    CREATE TABLE IF NOT EXISTS newsletter_user_favorites (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ga_id INTEGER NOT NULL,
      newsletter_id TEXT NOT NULL REFERENCES insurance_company_newsletters(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, ga_id, newsletter_id)
    )
  `)
}
