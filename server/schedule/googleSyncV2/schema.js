import { isProductionDbTarget } from '../../lib/dbEnvironmentGuard.js'
import { isProductionRuntime } from '../../lib/crmUserBulkSmsConfig.js'
import { isOnefcGoogleSyncV2Enabled } from './flag.js'

/**
 * calendar_items 를 사용자 소유 일정 저장소로 보강한다.
 * 할 일 테이블은 만들지 않는다(기존 todos).
 * external_sync_links · sync_outbox 는 이 Phase 에서 만들기만 하고, Google 쓰기는 하지 않는다.
 * 문장은 모두 추가·멱등이다. DROP / DELETE / TRUNCATE 없음.
 * @returns {string[]}
 */
export function googleSyncV2SchemaStatements() {
  return [
    `ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS owner_user_id TEXT`,
    `ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS start_date DATE`,
    `ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS end_date DATE`,
    `ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Seoul'`,
    `ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS recurrence JSONB`,
    `ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS customer_id BIGINT`,
    `ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS origin TEXT`,
    `ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS request_id TEXT`,
    `
    UPDATE calendar_items
    SET owner_user_id = owner_id
    WHERE owner_user_id IS NULL
      AND owner_type = 'user'
      AND owner_id IS NOT NULL
      AND btrim(owner_id) <> ''
    `,
    `
    UPDATE calendar_items
    SET origin = 'onefc'
    WHERE origin IS NULL
    `,
    `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'calendar_items_owner_user_id_required'
      ) THEN
        ALTER TABLE calendar_items
          ADD CONSTRAINT calendar_items_owner_user_id_required
          CHECK (owner_user_id IS NOT NULL AND btrim(owner_user_id) <> '')
          NOT VALID;
      END IF;
    END $$;
    `,
    `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM calendar_items
        WHERE owner_user_id IS NULL OR btrim(owner_user_id) = ''
      ) THEN
        ALTER TABLE calendar_items VALIDATE CONSTRAINT calendar_items_owner_user_id_required;
        ALTER TABLE calendar_items ALTER COLUMN owner_user_id SET NOT NULL;
      END IF;
    END $$;
    `,
    `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'calendar_items_origin_check'
      ) THEN
        ALTER TABLE calendar_items
          ADD CONSTRAINT calendar_items_origin_check
          CHECK (origin IN ('onefc', 'google_import'))
          NOT VALID;
      END IF;
    END $$;
    `,
    `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM calendar_items
        WHERE origin IS NULL OR origin NOT IN ('onefc', 'google_import')
      ) THEN
        ALTER TABLE calendar_items VALIDATE CONSTRAINT calendar_items_origin_check;
        ALTER TABLE calendar_items ALTER COLUMN origin SET NOT NULL;
      END IF;
    END $$;
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_calendar_items_owner_user
    ON calendar_items (owner_user_id)
    WHERE deleted_at IS NULL
    `,
    `
    CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_items_owner_request
    ON calendar_items (owner_user_id, request_id)
    WHERE request_id IS NOT NULL
    `,
    `
    CREATE TABLE IF NOT EXISTS external_sync_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      google_account_id TEXT NOT NULL,
      local_type TEXT NOT NULL,
      local_id TEXT NOT NULL,
      remote_container_id TEXT NOT NULL,
      remote_id TEXT NOT NULL,
      remote_etag TEXT,
      remote_updated_at TIMESTAMPTZ,
      local_version_synced INTEGER,
      content_hash TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      last_error TEXT,
      history JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT external_sync_links_provider_check CHECK (provider IN ('google_calendar', 'google_tasks')),
      CONSTRAINT external_sync_links_local_type_check CHECK (local_type IN ('calendar_item', 'todo')),
      CONSTRAINT external_sync_links_status_check CHECK (
        status IN ('active', 'pending_delete', 'deleted', 'conflict', 'failed', 'detached')
      )
    )
    `,
    `
    CREATE UNIQUE INDEX IF NOT EXISTS uq_external_sync_links_local
    ON external_sync_links (owner_user_id, provider, local_type, local_id)
    `,
    `
    CREATE UNIQUE INDEX IF NOT EXISTS uq_external_sync_links_remote
    ON external_sync_links (
      owner_user_id, provider, google_account_id, remote_container_id, remote_id
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS sync_outbox (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      local_type TEXT NOT NULL,
      local_id TEXT NOT NULL,
      op TEXT NOT NULL,
      local_version INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_error_class TEXT,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT sync_outbox_provider_check CHECK (provider IN ('google_calendar', 'google_tasks')),
      CONSTRAINT sync_outbox_local_type_check CHECK (local_type IN ('calendar_item', 'todo')),
      CONSTRAINT sync_outbox_op_check CHECK (op IN ('upsert', 'delete'))
    )
    `,
    `
    CREATE UNIQUE INDEX IF NOT EXISTS uq_sync_outbox_local_item
    ON sync_outbox (owner_user_id, provider, local_type, local_id)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_sync_outbox_due
    ON sync_outbox (next_attempt_at)
    `,
  ]
}

/**
 * @param {string} code
 */
function schemaError(code) {
  const error = new Error(code)
  error.code = code
  return error
}

/**
 * 플래그가 켜진 Dev 에서만 실행한다.
 * 운영 런타임·운영 DB 에서는 문장을 하나도 보내지 않는다.
 * @param {{ query: Function }} executor
 * @param {NodeJS.ProcessEnv} [env]
 */
export async function ensureGoogleSyncV2Schema(executor, env = process.env) {
  if (isProductionRuntime(env)) {
    throw schemaError('google_sync_v2_production_runtime')
  }
  if (env.DATABASE_URL && isProductionDbTarget(env.DATABASE_URL, env)) {
    throw schemaError('google_sync_v2_production_db')
  }
  if (!isOnefcGoogleSyncV2Enabled(env)) {
    throw schemaError('google_sync_v2_disabled')
  }
  for (const statement of googleSyncV2SchemaStatements()) {
    await executor.query(statement)
  }
}
