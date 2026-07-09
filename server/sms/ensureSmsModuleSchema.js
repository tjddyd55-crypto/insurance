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
    ALTER TABLE sms_provider_accounts
    ADD COLUMN IF NOT EXISTS ad_display_name TEXT NOT NULL DEFAULT ''
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
    ALTER TABLE sms_recipients
    ADD COLUMN IF NOT EXISTS gender_snapshot TEXT NOT NULL DEFAULT ''
  `)
  await executor.query(`
    ALTER TABLE sms_recipients
    ADD COLUMN IF NOT EXISTS birth_date_snapshot DATE
  `)
  await executor.query(`
    ALTER TABLE sms_recipients
    ADD COLUMN IF NOT EXISTS insurance_age_snapshot INTEGER
  `)
  await executor.query(`
    ALTER TABLE sms_recipients
    ADD COLUMN IF NOT EXISTS sangnyeong_dday_snapshot INTEGER
  `)
  await executor.query(`
    ALTER TABLE sms_recipients
    ADD COLUMN IF NOT EXISTS customer_name_snapshot TEXT NOT NULL DEFAULT ''
  `)
  await executor.query(`
    ALTER TABLE sms_recipients
    ADD COLUMN IF NOT EXISTS phone_snapshot TEXT NOT NULL DEFAULT ''
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS sms_recipient_groups (
      id BIGSERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      recipient_count INTEGER NOT NULL DEFAULT 0,
      last_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      archived_at TIMESTAMPTZ
    )
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_recipient_groups_tenant_user
    ON sms_recipient_groups (tenant_id, user_id, updated_at DESC)
    WHERE archived_at IS NULL
  `)
  await executor.query(`
    CREATE TABLE IF NOT EXISTS sms_recipient_group_members (
      id BIGSERIAL PRIMARY KEY,
      group_id BIGINT NOT NULL REFERENCES sms_recipient_groups(id) ON DELETE CASCADE,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT sms_recipient_group_members_unique UNIQUE (group_id, customer_id)
    )
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_recipient_group_members_group
    ON sms_recipient_group_members (group_id, customer_id)
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

  await executor.query(`
    CREATE TABLE IF NOT EXISTS sms_scheduled_messages (
      id BIGSERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      recipient_group_id BIGINT NOT NULL REFERENCES sms_recipient_groups(id) ON DELETE RESTRICT,
      message_body TEXT NOT NULL DEFAULT '',
      message_type TEXT NOT NULL DEFAULT 'info',
      schedule_type TEXT NOT NULL DEFAULT 'once',
      send_date DATE,
      send_time TEXT NOT NULL DEFAULT '09:00',
      timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
      weekdays INTEGER[] NOT NULL DEFAULT '{}',
      month_day INTEGER,
      template_id BIGINT REFERENCES sms_templates(id) ON DELETE SET NULL,
      next_run_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'active',
      last_run_at TIMESTAMPTZ,
      run_count INTEGER NOT NULL DEFAULT 0,
      last_campaign_id BIGINT REFERENCES sms_campaigns(id) ON DELETE SET NULL,
      last_error_code TEXT,
      last_error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      CONSTRAINT sms_scheduled_messages_message_type_check CHECK (message_type IN ('info', 'ad')),
      CONSTRAINT sms_scheduled_messages_schedule_type_check CHECK (
        schedule_type IN ('once', 'daily', 'weekly', 'monthly')
      ),
      CONSTRAINT sms_scheduled_messages_status_check CHECK (
        status IN ('active', 'paused', 'processing', 'completed', 'failed', 'deleted')
      )
    )
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_scheduled_messages_due
    ON sms_scheduled_messages (next_run_at ASC)
    WHERE deleted_at IS NULL AND status = 'active' AND next_run_at IS NOT NULL
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_scheduled_messages_tenant_user
    ON sms_scheduled_messages (tenant_id, user_id, updated_at DESC)
    WHERE deleted_at IS NULL
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS sms_scheduled_message_deliveries (
      id BIGSERIAL PRIMARY KEY,
      scheduled_message_id BIGINT NOT NULL REFERENCES sms_scheduled_messages(id) ON DELETE CASCADE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      phone TEXT NOT NULL DEFAULT '',
      scheduled_run_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      provider_message_id TEXT,
      error_code TEXT,
      error_message TEXT,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT sms_scheduled_message_deliveries_status_check CHECK (
        status IN ('pending', 'success', 'failed', 'skipped')
      )
    )
  `)
  await executor.query(`DROP INDEX IF EXISTS idx_sms_scheduled_deliveries_unique`)
  await executor.query(`DROP INDEX IF EXISTS sms_scheduled_message_deliveries_unique_run`)
  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS sms_scheduled_message_deliveries_unique_run
    ON sms_scheduled_message_deliveries (scheduled_message_id, phone, scheduled_run_at)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS sms_scheduled_runs (
      id TEXT PRIMARY KEY,
      scheduled_message_id BIGINT NOT NULL REFERENCES sms_scheduled_messages(id) ON DELETE CASCADE,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scheduled_run_at TIMESTAMPTZ NOT NULL,
      campaign_id BIGINT REFERENCES sms_campaigns(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_count INTEGER NOT NULL DEFAULT 0,
      queued_count INTEGER NOT NULL DEFAULT 0,
      sent_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT sms_scheduled_runs_status_check CHECK (
        status IN ('pending', 'queued', 'processing', 'completed', 'partial_failed', 'failed')
      )
    )
  `)
  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS sms_scheduled_runs_unique_run
    ON sms_scheduled_runs (scheduled_message_id, scheduled_run_at)
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_scheduled_runs_status
    ON sms_scheduled_runs (status, updated_at DESC)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS sms_send_jobs (
      id TEXT PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      run_id TEXT REFERENCES sms_scheduled_runs(id) ON DELETE CASCADE,
      campaign_id BIGINT REFERENCES sms_campaigns(id) ON DELETE SET NULL,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      phone TEXT NOT NULL,
      sender_number TEXT NOT NULL DEFAULT '',
      message_body TEXT NOT NULL DEFAULT '',
      message_type TEXT NOT NULL DEFAULT 'SMS',
      is_advertising BOOLEAN NOT NULL DEFAULT false,
      status TEXT NOT NULL DEFAULT 'queued',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      locked_at TIMESTAMPTZ,
      locked_by TEXT,
      provider_message_id TEXT,
      error_code TEXT,
      error_message TEXT,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT sms_send_jobs_source_type_check CHECK (
        source_type IN ('immediate', 'scheduled', 'automation')
      ),
      CONSTRAINT sms_send_jobs_status_check CHECK (
        status IN ('queued', 'processing', 'sent', 'failed', 'skipped', 'retry')
      )
    )
  `)
  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS sms_send_jobs_unique_source_recipient
    ON sms_send_jobs (source_type, source_id, run_id, phone)
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_send_jobs_claim
    ON sms_send_jobs (status, scheduled_for ASC, created_at ASC)
    WHERE status IN ('queued', 'retry')
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS sms_automation_rules (
      id BIGSERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ga_id INTEGER REFERENCES ga_companies(id) ON DELETE SET NULL,
      rule_name TEXT NOT NULL DEFAULT '',
      trigger_type TEXT NOT NULL,
      special_date_purpose_type TEXT,
      day_offset INTEGER NOT NULL DEFAULT 0,
      send_time TEXT NOT NULL DEFAULT '10:00',
      message_body TEXT NOT NULL DEFAULT '',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      CONSTRAINT sms_automation_rules_trigger_type_check CHECK (
        trigger_type IN ('BIRTHDAY', 'CAR_INSURANCE_EXPIRY', 'INSURANCE_AGE', 'CUSTOMER_SPECIAL_DATE')
      ),
      CONSTRAINT sms_automation_rules_special_date_purpose_check CHECK (
        special_date_purpose_type IS NULL
        OR special_date_purpose_type IN ('ALL', 'CELEBRATION', 'THANKS', 'NOTICE', 'CHECKUP')
      ),
      CONSTRAINT sms_automation_rules_day_offset_check CHECK (day_offset >= 0 AND day_offset <= 366)
    )
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_automation_rules_tenant_user
    ON sms_automation_rules (tenant_id, user_id, updated_at DESC)
    WHERE deleted_at IS NULL
  `)
  await executor.query(`
    ALTER TABLE sms_automation_rules
    ADD COLUMN IF NOT EXISTS exclude_minors BOOLEAN NOT NULL DEFAULT FALSE
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS sms_automation_runs (
      id BIGSERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      ga_id INTEGER REFERENCES ga_companies(id) ON DELETE SET NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rule_id BIGINT NOT NULL REFERENCES sms_automation_rules(id) ON DELETE CASCADE,
      run_type TEXT NOT NULL,
      run_mode TEXT NOT NULL,
      base_date DATE NOT NULL,
      target_date DATE NOT NULL,
      scheduled_send_time TEXT NOT NULL DEFAULT '10:00',
      status TEXT NOT NULL DEFAULT 'RUNNING',
      total_count INTEGER NOT NULL DEFAULT 0,
      sendable_count INTEGER NOT NULL DEFAULT 0,
      excluded_count INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      skipped_duplicate_count INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT sms_automation_runs_run_type_check CHECK (run_type IN ('MANUAL', 'SCHEDULED')),
      CONSTRAINT sms_automation_runs_run_mode_check CHECK (
        run_mode IN ('DRY_RUN', 'REAL_SEND', 'SIMULATED_SEND')
      ),
      CONSTRAINT sms_automation_runs_status_check CHECK (
        status IN ('RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL_FAILED')
      )
    )
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_automation_runs_tenant_user
    ON sms_automation_runs (tenant_id, user_id, created_at DESC)
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_automation_runs_rule
    ON sms_automation_runs (rule_id, created_at DESC)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS sms_automation_run_items (
      id BIGSERIAL PRIMARY KEY,
      run_id BIGINT NOT NULL REFERENCES sms_automation_runs(id) ON DELETE CASCADE,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      ga_id INTEGER REFERENCES ga_companies(id) ON DELETE SET NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rule_id BIGINT NOT NULL REFERENCES sms_automation_rules(id) ON DELETE CASCADE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      phone TEXT NOT NULL DEFAULT '',
      customer_name TEXT NOT NULL DEFAULT '',
      trigger_type TEXT NOT NULL,
      reference_type TEXT,
      reference_id BIGINT,
      reference_title TEXT,
      reference_date DATE,
      trigger_instance_key TEXT NOT NULL DEFAULT '',
      message_body TEXT NOT NULL DEFAULT '',
      sendable BOOLEAN NOT NULL DEFAULT false,
      excluded_reason TEXT,
      send_status TEXT NOT NULL DEFAULT 'EXCLUDED',
      send_result_code TEXT,
      send_result_message TEXT,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT sms_automation_run_items_send_status_check CHECK (
        send_status IN ('EXCLUDED', 'SKIPPED_DUPLICATE', 'SIMULATED', 'SENT', 'FAILED')
      )
    )
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_automation_run_items_run
    ON sms_automation_run_items (run_id, id)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS sms_automation_send_dedupes (
      id BIGSERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      ga_id INTEGER REFERENCES ga_companies(id) ON DELETE SET NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rule_id BIGINT NOT NULL REFERENCES sms_automation_rules(id) ON DELETE CASCADE,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      trigger_instance_key TEXT NOT NULL,
      reference_date DATE NOT NULL,
      run_item_id BIGINT REFERENCES sms_automation_run_items(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS sms_automation_send_dedupes_unique
    ON sms_automation_send_dedupes (rule_id, customer_id, trigger_instance_key, reference_date)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS sms_automation_scheduler_locks (
      id BIGSERIAL PRIMARY KEY,
      rule_id BIGINT NOT NULL REFERENCES sms_automation_rules(id) ON DELETE CASCADE,
      run_date DATE NOT NULL,
      send_time TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS sms_automation_scheduler_locks_unique
    ON sms_automation_scheduler_locks (rule_id, run_date, send_time)
  `)
}
