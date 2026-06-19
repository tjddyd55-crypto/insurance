/**
 * promotion_codes 테이블 idempotent 컬럼 보강.
 * CREATE TABLE IF NOT EXISTS 만으로는 기존 테이블에 신규 컬럼이 반영되지 않으므로
 * createPromotionCodeAdmin INSERT 컬럼과 실제 DB를 맞춘다.
 */
export async function ensurePromotionCodesSchema(executor) {
  await executor.query(`
    ALTER TABLE promotion_codes
      ADD COLUMN IF NOT EXISTS code TEXT,
      ADD COLUMN IF NOT EXISTS code_normalized TEXT,
      ADD COLUMN IF NOT EXISTS code_type TEXT DEFAULT 'discount',
      ADD COLUMN IF NOT EXISTS discount_type TEXT,
      ADD COLUMN IF NOT EXISTS discount_amount INTEGER,
      ADD COLUMN IF NOT EXISTS discount_percent INTEGER,
      ADD COLUMN IF NOT EXISTS duration_months INTEGER,
      ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS max_uses INTEGER,
      ADD COLUMN IF NOT EXISTS used_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS per_account_limit INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS owner_name TEXT,
      ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'normal',
      ADD COLUMN IF NOT EXISTS memo TEXT,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id) ON DELETE SET NULL
  `)

  // 초기 initDb CREATE 가 created_by_user_id 를 쓴 환경 → created_by 로 백필
  await executor.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'promotion_codes'
          AND column_name = 'created_by_user_id'
      )
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'promotion_codes'
          AND column_name = 'created_by'
      ) THEN
        UPDATE promotion_codes
        SET created_by = created_by_user_id
        WHERE created_by IS NULL
          AND created_by_user_id IS NOT NULL;
      END IF;
    END $$
  `)
}
