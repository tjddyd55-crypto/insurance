/**
 * 연계 고객 그룹 스키마 (idempotent).
 * customers.id = INTEGER, users.id = TEXT 규칙을 따른다.
 * @param {{ query: Function }} executor pool 또는 client
 */
export async function ensureCustomerRelationGroupsSchema(executor) {
  await executor.query(`
    CREATE TABLE IF NOT EXISTS customer_relation_groups (
      id SERIAL PRIMARY KEY,
      ga_id INTEGER NOT NULL REFERENCES ga_companies(id),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      group_type TEXT NOT NULL DEFAULT 'FAMILY',
      memo TEXT NULL,
      created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
      deleted_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await executor.query(`
    ALTER TABLE customer_relation_groups
    DROP CONSTRAINT IF EXISTS customer_relation_groups_group_type_check
  `)
  await executor.query(`
    ALTER TABLE customer_relation_groups
    ADD CONSTRAINT customer_relation_groups_group_type_check
    CHECK (group_type IN ('FAMILY', 'BUSINESS', 'ETC'))
  `)

  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_customer_relation_groups_scope
    ON customer_relation_groups (ga_id, user_id, deleted_at)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS customer_relation_group_members (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES customer_relation_groups(id) ON DELETE CASCADE,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      relationship_label TEXT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      deleted_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_crgm_active_group_customer
    ON customer_relation_group_members (group_id, customer_id)
    WHERE deleted_at IS NULL
  `)

  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_crgm_group_active
    ON customer_relation_group_members (group_id, deleted_at)
  `)

  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_crgm_customer_active
    ON customer_relation_group_members (customer_id, deleted_at)
  `)
}
