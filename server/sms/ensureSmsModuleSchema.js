/**
 * CRM 업무 문자 모듈 — sms_provider_accounts, sms_sender_numbers, sms_campaigns 등.
 * initDb() 에서 idempotent 호출.
 */
export async function ensureSmsModuleSchema(executor) {
  await executor.query(`
    CREATE TABLE IF NOT EXISTS sms_provider_accounts (
      id BIGSERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL DEFAULT 'aligo',
      provider_user_id TEXT NOT NULL DEFAULT '',
      api_key_encrypted TEXT NOT NULL DEFAULT '',
      default_sender TEXT NOT NULL DEFAULT '',
      is_active BOOLEAN NOT NULL DEFAULT true,
      last_balance_checked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT sms_provider_accounts_provider_check CHECK (provider IN ('aligo')),
      CONSTRAINT sms_provider_accounts_user_provider_unique UNIQUE (user_id, provider)
    )
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_provider_accounts_tenant_user
    ON sms_provider_accounts (tenant_id, user_id)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS sms_sender_numbers (
      id BIGSERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_account_id BIGINT NOT NULL REFERENCES sms_provider_accounts(id) ON DELETE CASCADE,
      sender_number TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      is_default BOOLEAN NOT NULL DEFAULT false,
      last_test_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await executor.query(`
    ALTER TABLE sms_sender_numbers DROP CONSTRAINT IF EXISTS sms_sender_numbers_status_check
  `)
  await executor.query(`
    ALTER TABLE sms_sender_numbers
    ADD CONSTRAINT sms_sender_numbers_status_check
    CHECK (status IN ('pending', 'verified', 'disabled', 'test_passed'))
  `)
  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_sender_numbers_user_number
    ON sms_sender_numbers (user_id, sender_number)
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_sender_numbers_tenant_user
    ON sms_sender_numbers (tenant_id, user_id)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS sms_campaigns (
      id BIGSERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      message_type TEXT NOT NULL DEFAULT 'info',
      sender_number TEXT NOT NULL DEFAULT '',
      target_count INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      fail_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_at TIMESTAMPTZ,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT sms_campaigns_message_type_check CHECK (message_type IN ('info', 'ad')),
      CONSTRAINT sms_campaigns_status_check CHECK (
        status IN ('draft', 'scheduled', 'sending', 'completed', 'failed', 'canceled')
      )
    )
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_campaigns_tenant_user
    ON sms_campaigns (tenant_id, user_id, created_at DESC)
  `)
  await executor.query(`
    ALTER TABLE sms_campaigns
    ADD COLUMN IF NOT EXISTS preview_validated_at TIMESTAMPTZ
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS sms_recipients (
      id BIGSERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      campaign_id BIGINT NOT NULL REFERENCES sms_campaigns(id) ON DELETE CASCADE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      phone TEXT NOT NULL,
      customer_name TEXT,
      message TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      skip_reason TEXT,
      provider_message_id TEXT,
      fail_reason TEXT,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT sms_recipients_status_check CHECK (
        status IN ('pending', 'success', 'failed', 'skipped')
      )
    )
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_recipients_campaign
    ON sms_recipients (campaign_id, id)
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_recipients_tenant_phone
    ON sms_recipients (tenant_id, phone)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS sms_templates (
      id BIGSERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      message_type TEXT NOT NULL DEFAULT 'info',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT sms_templates_message_type_check CHECK (message_type IN ('info', 'ad'))
    )
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_templates_tenant_user
    ON sms_templates (tenant_id, user_id, updated_at DESC)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS sms_opt_outs (
      id BIGSERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      phone TEXT NOT NULL,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_opt_outs_tenant_phone
    ON sms_opt_outs (tenant_id, phone)
  `)
}
