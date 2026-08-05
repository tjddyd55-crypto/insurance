/**
 * 공개 도입·이용 문의 테이블 (idempotent).
 * CREATE TABLE IF NOT EXISTS + ALTER ADD COLUMN IF NOT EXISTS 패턴.
 *
 * @param {{ query: Function }} executor pool 또는 client
 */
export async function ensurePublicServiceInquiriesSchema(executor) {
  await executor.query(`
    CREATE TABLE IF NOT EXISTS public_service_inquiries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      inquiry_type TEXT NOT NULL,
      name TEXT NOT NULL,
      phone_normalized TEXT NOT NULL,
      phone_display TEXT NOT NULL,
      organization_name TEXT,
      email TEXT,
      preferred_contact_time TEXT,
      message TEXT NOT NULL,
      message_hash TEXT NOT NULL,
      privacy_consent BOOLEAN NOT NULL,
      privacy_consent_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'NEW',
      admin_memo TEXT,
      assigned_admin_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      source TEXT NOT NULL DEFAULT 'INTRODUCTION',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ
    )
  `)

  await executor.query(`
    ALTER TABLE public_service_inquiries
      ADD COLUMN IF NOT EXISTS inquiry_type TEXT,
      ADD COLUMN IF NOT EXISTS name TEXT,
      ADD COLUMN IF NOT EXISTS phone_normalized TEXT,
      ADD COLUMN IF NOT EXISTS phone_display TEXT,
      ADD COLUMN IF NOT EXISTS organization_name TEXT,
      ADD COLUMN IF NOT EXISTS email TEXT,
      ADD COLUMN IF NOT EXISTS preferred_contact_time TEXT,
      ADD COLUMN IF NOT EXISTS message TEXT,
      ADD COLUMN IF NOT EXISTS message_hash TEXT,
      ADD COLUMN IF NOT EXISTS privacy_consent BOOLEAN,
      ADD COLUMN IF NOT EXISTS privacy_consent_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'NEW',
      ADD COLUMN IF NOT EXISTS admin_memo TEXT,
      ADD COLUMN IF NOT EXISTS assigned_admin_id TEXT,
      ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'INTRODUCTION',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
  `)

  // assigned_admin_id FK — 기존 테이블에 컬럼만 있고 FK가 없을 수 있음
  await executor.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'public_service_inquiries'
          AND constraint_name = 'public_service_inquiries_assigned_admin_id_fkey'
      ) THEN
        ALTER TABLE public_service_inquiries
          ADD CONSTRAINT public_service_inquiries_assigned_admin_id_fkey
          FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE SET NULL;
      END IF;
    END $$
  `)

  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_psi_status_created
    ON public_service_inquiries (status, created_at DESC)
    WHERE deleted_at IS NULL
  `)

  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_psi_dedupe
    ON public_service_inquiries (phone_normalized, inquiry_type, message_hash, created_at DESC)
  `)

  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_psi_new_count
    ON public_service_inquiries (created_at DESC)
    WHERE deleted_at IS NULL AND status = 'NEW'
  `)
}
