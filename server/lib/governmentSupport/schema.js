/**
 * government-support 전용 테이블 (idempotent DDL).
 */
export async function ensureGovernmentSupportSchema(executor) {
  await executor.query(`
    CREATE TABLE IF NOT EXISTS gov_support_profiles (
      id BIGSERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      carrier TEXT NOT NULL DEFAULT '',
      ssn TEXT NOT NULL DEFAULT '',
      home_address TEXT NOT NULL DEFAULT '',
      home_type TEXT NOT NULL DEFAULT '',
      deposit TEXT NOT NULL DEFAULT '',
      monthly_rent TEXT NOT NULL DEFAULT '',
      credit_score_1 TEXT NOT NULL DEFAULT '',
      credit_score_2 TEXT NOT NULL DEFAULT '',
      business_name TEXT NOT NULL DEFAULT '',
      business_opened_at TEXT NOT NULL DEFAULT '',
      business_number TEXT NOT NULL DEFAULT '',
      business_address TEXT NOT NULL DEFAULT '',
      business_category TEXT NOT NULL DEFAULT '',
      business_type TEXT NOT NULL DEFAULT '',
      business_form TEXT NOT NULL DEFAULT '',
      business_phone TEXT NOT NULL DEFAULT '',
      product_name TEXT NOT NULL DEFAULT '',
      available_product TEXT NOT NULL DEFAULT '',
      progress_status TEXT NOT NULL DEFAULT '상담 접수',
      schedule_at TEXT NOT NULL DEFAULT '',
      agency_org TEXT NOT NULL DEFAULT '',
      assignee_user_id TEXT,
      region TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      special_note TEXT NOT NULL DEFAULT '',
      vat_report TEXT NOT NULL DEFAULT '',
      annual_income TEXT NOT NULL DEFAULT '',
      income_cert TEXT NOT NULL DEFAULT '',
      tax_arrears TEXT NOT NULL DEFAULT '',
      required_funds TEXT NOT NULL DEFAULT '',
      fee TEXT NOT NULL DEFAULT '',
      cert_delegate TEXT NOT NULL DEFAULT '',
      cert_type TEXT NOT NULL DEFAULT '',
      delegate_status TEXT NOT NULL DEFAULT '',
      delegation_memo TEXT NOT NULL DEFAULT '',
      edoc_status TEXT NOT NULL DEFAULT '',
      doc_status TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_gov_support_profiles_tenant
    ON gov_support_profiles (tenant_id, updated_at DESC)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS gov_support_prior_loans (
      id BIGSERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      profile_id BIGINT NOT NULL REFERENCES gov_support_profiles(id) ON DELETE CASCADE,
      has_prior TEXT NOT NULL DEFAULT '',
      lender_name TEXT NOT NULL DEFAULT '',
      remaining_amount TEXT NOT NULL DEFAULT '',
      received_at TEXT NOT NULL DEFAULT '',
      policy_included TEXT NOT NULL DEFAULT '',
      memo TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS gov_support_application_cases (
      id BIGSERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      profile_id BIGINT NOT NULL REFERENCES gov_support_profiles(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL DEFAULT '',
      available_product TEXT NOT NULL DEFAULT '',
      progress_status TEXT NOT NULL DEFAULT '상담 접수',
      schedule_at TEXT NOT NULL DEFAULT '',
      agency_org TEXT NOT NULL DEFAULT '',
      assignee_user_id TEXT,
      required_funds TEXT NOT NULL DEFAULT '',
      fee TEXT NOT NULL DEFAULT '',
      cert_delegate TEXT NOT NULL DEFAULT '',
      special_note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS gov_support_document_items (
      id BIGSERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      profile_id BIGINT NOT NULL REFERENCES gov_support_profiles(id) ON DELETE CASCADE,
      application_case_id BIGINT REFERENCES gov_support_application_cases(id) ON DELETE SET NULL,
      doc_type TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '요청 전',
      storage_key TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS gov_support_edoc_links (
      id BIGSERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      profile_id BIGINT NOT NULL REFERENCES gov_support_profiles(id) ON DELETE CASCADE,
      application_case_id BIGINT REFERENCES gov_support_application_cases(id) ON DELETE SET NULL,
      document_name TEXT NOT NULL DEFAULT '',
      sent_at TIMESTAMPTZ,
      recipient TEXT NOT NULL DEFAULT '',
      sign_status TEXT NOT NULL DEFAULT '대기',
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}
