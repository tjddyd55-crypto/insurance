export const MIN_CUSTOMERS = 30
export const MAX_CUSTOMERS = 100

export const TABLE_ORDER = [
  'customers',
  'customer_consultations',
  'memo',
  'customer_cars',
  'customer_special_dates',
  'files',
  'customer_relation_groups',
  'customer_relation_group_members',
  'customer_relations',
  'todos',
  'ta_call_settings',
  'ta_call_assignments',
  'customer_card_payment_contracts',
  'notifications',
  'customer_app_links',
  'customer_app_profiles',
  'customer_claim_requests',
  'customer_claim_request_files',
]

export const RESET_ORDER = [...TABLE_ORDER].reverse()

export const OPTIONAL_TABLES = new Set(TABLE_ORDER.filter((table) => table !== 'customers'))

export const SOURCE_SQL = Object.freeze({
  ga: `SELECT id, code FROM ga_companies WHERE UPPER(TRIM(code)) = UPPER(TRIM($1)) LIMIT 2`,
  targetUser: `SELECT id, ga_id, tenant_id FROM users WHERE id = $1 LIMIT 1`,
  customers: `SELECT c.* FROM customers c
    WHERE c.ga_id = $1 AND c.deleted_at IS NULL
    ORDER BY (
      (SELECT COUNT(*) FROM customer_consultations cc WHERE cc.customer_id = c.id)
      + (SELECT COUNT(*) FROM customer_cars car WHERE car.customer_id = c.id)
      + (SELECT COUNT(*) FROM customer_special_dates sd WHERE sd.customer_id = c.id AND sd.deleted_at IS NULL)
      + (SELECT COUNT(*) * 2 FROM files f WHERE f.customer_id = c.id AND f.deleted_at IS NULL)
      + (SELECT COUNT(*) * 3 FROM customer_claim_requests cr WHERE cr.customer_id = c.id)
      + (SELECT COUNT(*) * 2 FROM customer_relations rel
          WHERE rel.customer_id = c.id OR rel.related_customer_id = c.id)
    ) DESC, c.created_at DESC, c.id DESC
    LIMIT $2`,
  customer_consultations: `SELECT * FROM customer_consultations WHERE customer_id = ANY($1::int[]) ORDER BY id`,
  memo: `SELECT * FROM memo WHERE ga_id = $1 AND user_id = ANY($2::text[]) ORDER BY updated_at DESC LIMIT 100`,
  customer_cars: `SELECT * FROM customer_cars WHERE customer_id = ANY($1::int[]) ORDER BY id`,
  customer_special_dates: `SELECT * FROM customer_special_dates WHERE customer_id = ANY($1::int[]) ORDER BY id`,
  files: `SELECT * FROM files WHERE customer_id = ANY($1::int[]) AND deleted_at IS NULL AND status = 'active' ORDER BY id`,
  customer_relation_groups: `SELECT DISTINCT g.* FROM customer_relation_groups g INNER JOIN customer_relation_group_members m ON m.group_id = g.id WHERE m.customer_id = ANY($1::int[]) ORDER BY g.id`,
  customer_relation_group_members: `SELECT * FROM customer_relation_group_members WHERE customer_id = ANY($1::int[]) ORDER BY id`,
  customer_relations: `SELECT * FROM customer_relations WHERE customer_id = ANY($1::int[]) AND related_customer_id = ANY($1::int[]) ORDER BY id`,
  todos: `SELECT * FROM todos WHERE related_entity_type = 'customer' AND related_entity_id = ANY($1::text[]) ORDER BY id`,
  ta_call_settings: `SELECT * FROM ta_call_settings WHERE user_id = ANY($1::text[]) ORDER BY id`,
  ta_call_assignments: `SELECT * FROM ta_call_assignments WHERE customer_id = ANY($1::int[]) ORDER BY id`,
  customer_card_payment_contracts: `SELECT * FROM customer_card_payment_contracts WHERE customer_id = ANY($1::int[]) AND deleted_at IS NULL ORDER BY id`,
  notifications: `SELECT * FROM notifications WHERE customer_id = ANY($1::int[]) ORDER BY id`,
  customer_app_links: `SELECT * FROM customer_app_links WHERE customer_id = ANY($1::int[]) ORDER BY id`,
  customer_app_profiles: `SELECT * FROM customer_app_profiles WHERE customer_id = ANY($1::int[]) ORDER BY id`,
  customer_claim_requests: `SELECT * FROM customer_claim_requests WHERE customer_id = ANY($1::int[]) ORDER BY id`,
  customer_claim_request_files: `SELECT * FROM customer_claim_request_files WHERE customer_id = ANY($1::int[]) ORDER BY id`,
  tableColumns: `SELECT table_name, column_name, is_nullable, column_default, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($1::text[]) ORDER BY table_name, ordinal_position`,
})

export const USER_ID_COLUMNS = new Set([
  'user_id',
  'owner_user_id',
  'assignee_user_id',
  'created_by_user_id',
  'created_by',
  'agent_id',
  'processed_by_user_id',
  'changed_by_user_id',
])

export const FREE_TEXT_COLUMNS = new Set([
  'address',
  'body',
  'content',
  'description',
  'driving',
  'job',
  'medical',
  'memo',
  'message',
  'note',
  'inflow_source_note',
  'referrer_name',
  'relationship_label',
  'title',
])

export const EXCLUDED_COLUMNS = new Set([
  'password',
  'password_hash',
  'token',
  'push_token',
  'provider_id',
  'provider_transaction_id',
  'raw_response',
  'signature_data',
])
