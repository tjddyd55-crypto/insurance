/**
 * 슈퍼 어드민 → CRM 사용자 단체 안내문자 전용 스키마.
 * 고객 SMS(`sms_*`) 및 인증 SMS Gateway 와 분리한다.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function ensureCrmUserBulkSmsSchema(executor) {
  await executor.query(`
    CREATE TABLE IF NOT EXISTS crm_user_bulk_sms_campaigns (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      message_template TEXT NOT NULL,
      sender_number TEXT NOT NULL,
      sms_type TEXT NOT NULL DEFAULT 'SMS',
      audience_type TEXT NOT NULL DEFAULT 'CRM_USER',
      source_type TEXT NOT NULL DEFAULT 'SUPER_ADMIN_BULK_NOTICE',
      message_purpose TEXT NOT NULL DEFAULT 'service_notice',
      requested_by TEXT NOT NULL REFERENCES users(id),
      idempotency_key TEXT,
      target_count INTEGER NOT NULL DEFAULT 0,
      eligible_count INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      excluded_count INTEGER NOT NULL DEFAULT 0,
      dry_run BOOLEAN NOT NULL DEFAULT TRUE,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      filter_snapshot JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      CONSTRAINT crm_user_bulk_sms_campaigns_audience_chk
        CHECK (audience_type = 'CRM_USER'),
      CONSTRAINT crm_user_bulk_sms_campaigns_source_chk
        CHECK (source_type = 'SUPER_ADMIN_BULK_NOTICE'),
      CONSTRAINT crm_user_bulk_sms_campaigns_purpose_chk
        CHECK (message_purpose = 'service_notice'),
      CONSTRAINT crm_user_bulk_sms_campaigns_status_chk
        CHECK (status IN (
          'DRAFT', 'PREVIEWED', 'QUEUED', 'PROCESSING',
          'COMPLETED', 'PARTIAL_FAILED', 'FAILED', 'CANCELLED'
        )),
      CONSTRAINT crm_user_bulk_sms_campaigns_sms_type_chk
        CHECK (sms_type IN ('SMS', 'LMS'))
    )
  `)

  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS crm_user_bulk_sms_campaigns_idempotency_uidx
      ON crm_user_bulk_sms_campaigns (idempotency_key)
      WHERE idempotency_key IS NOT NULL
  `)

  await executor.query(`
    CREATE INDEX IF NOT EXISTS crm_user_bulk_sms_campaigns_created_idx
      ON crm_user_bulk_sms_campaigns (created_at DESC)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS crm_user_bulk_sms_recipients (
      id BIGSERIAL PRIMARY KEY,
      campaign_id BIGINT NOT NULL REFERENCES crm_user_bulk_sms_campaigns(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id),
      ga_id INTEGER,
      display_name TEXT,
      username TEXT,
      ga_company_name TEXT,
      role TEXT,
      phone_normalized TEXT,
      phone_masked TEXT,
      rendered_message TEXT,
      provider_message_id TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      exclusion_reason TEXT,
      error_code TEXT,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT crm_user_bulk_sms_recipients_status_chk
        CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'EXCLUDED', 'DRY_RUN'))
    )
  `)

  await executor.query(`
    CREATE INDEX IF NOT EXISTS crm_user_bulk_sms_recipients_campaign_idx
      ON crm_user_bulk_sms_recipients (campaign_id)
  `)

  await executor.query(`
    CREATE INDEX IF NOT EXISTS crm_user_bulk_sms_recipients_user_idx
      ON crm_user_bulk_sms_recipients (user_id)
  `)
}
