/**
 * Customer-centric relation graph for the generic semantic query engine.
 *
 * This is infrastructure metadata, not natural-language interpretation.
 * Every relation starts from the already-authorized customers row (alias c).
 */
export const CUSTOMER_GENERIC_RELATIONS = Object.freeze({
  customers: Object.freeze({
    alias: 'c',
    direct: true,
  }),
  customer_cars: Object.freeze({
    alias: 'gc_car',
    customerPredicate: 'gc_car.customer_id = c.id',
    scopePredicates: Object.freeze([
      'gc_car.user_id = {{user}}::text',
      'gc_car.ga_id = {{ga}}::integer',
    ]),
  }),
  customer_fire_insurance_locations: Object.freeze({
    alias: 'gc_fire',
    customerPredicate: 'gc_fire.customer_id = c.id',
    scopePredicates: Object.freeze([
      'gc_fire.user_id = {{user}}::text',
      'gc_fire.ga_id = {{ga}}::integer',
      'gc_fire.deleted_at IS NULL',
    ]),
  }),
  customer_special_dates: Object.freeze({
    alias: 'gc_special',
    customerPredicate: 'gc_special.customer_id = c.id',
    scopePredicates: Object.freeze([
      'gc_special.user_id = {{user}}::text',
      'gc_special.ga_id = {{ga}}::integer',
      'gc_special.deleted_at IS NULL',
    ]),
  }),
  customer_custom_fields: Object.freeze({
    alias: 'gc_custom',
    customerPredicate: 'gc_custom.customer_id = c.id',
    scopePredicates: Object.freeze([
      'gc_custom.user_id = {{user}}::text',
      'gc_custom.ga_id = {{ga}}::integer',
      'gc_custom.deleted_at IS NULL',
    ]),
  }),
  customer_consultations: Object.freeze({
    alias: 'gc_consult',
    customerPredicate: 'gc_consult.customer_id = c.id',
    scopePredicates: Object.freeze([
      'gc_consult.user_id = {{user}}::text',
      'gc_consult.ga_id = {{ga}}::integer',
    ]),
  }),
  customer_claim_requests: Object.freeze({
    alias: 'gc_claim',
    customerPredicate: 'gc_claim.customer_id = c.id',
    scopePredicates: Object.freeze([
      'gc_claim.agent_id = {{user}}::text',
    ]),
  }),
  customer_claim_request_files: Object.freeze({
    alias: 'gc_claim_file',
    customerPredicate: 'gc_claim_file.customer_id = c.id',
    scopePredicates: Object.freeze([
      'gc_claim_file.agent_id = {{user}}::text',
    ]),
  }),
  customer_app_profiles: Object.freeze({
    alias: 'gc_app_profile',
    customerPredicate: 'gc_app_profile.customer_id = c.id',
    scopePredicates: Object.freeze([
      'gc_app_profile.agent_id = {{user}}::text',
    ]),
  }),
  customer_files: Object.freeze({
    alias: 'gc_file',
    customerPredicate: 'gc_file.customer_id = c.id',
    scopePredicates: Object.freeze([
      'gc_file.user_id = {{user}}::text',
      'gc_file.ga_id = {{ga}}::integer',
      'gc_file.deleted_at IS NULL',
    ]),
  }),
  ta_call_assignments: Object.freeze({
    alias: 'gc_ta',
    customerPredicate: 'gc_ta.customer_id = c.id',
    scopePredicates: Object.freeze([
      'gc_ta.user_id = {{user}}::text',
    ]),
  }),
  customer_relations: Object.freeze({
    alias: 'gc_relation',
    customerPredicate: 'gc_relation.customer_id = c.id',
    scopePredicates: Object.freeze([
      'gc_relation.user_id = {{user}}::text',
      'gc_relation.ga_id = {{ga}}::integer',
    ]),
  }),
  customer_premium_payment_methods: Object.freeze({
    alias: 'gc_premium',
    customerPredicate: 'gc_premium.customer_id = c.id',
    scopePredicates: Object.freeze([
      'gc_premium.owner_user_id = {{user}}::text',
      'gc_premium.ga_id = {{ga}}::integer',
      'gc_premium.deleted_at IS NULL',
    ]),
  }),
  customer_payment_cards: Object.freeze({
    alias: 'gc_card',
    customerPredicate: 'gc_card.customer_id = c.id',
    scopePredicates: Object.freeze([
      'gc_card.owner_user_id = {{user}}::text',
      'gc_card.ga_id = {{ga}}::integer',
      'gc_card.deleted_at IS NULL',
    ]),
  }),
  customer_card_payment_contracts: Object.freeze({
    alias: 'gc_payment_contract',
    customerPredicate: 'gc_payment_contract.customer_id = c.id',
    scopePredicates: Object.freeze([
      'gc_payment_contract.owner_user_id = {{user}}::text',
      'gc_payment_contract.ga_id = {{ga}}::integer',
      'gc_payment_contract.deleted_at IS NULL',
    ]),
  }),
  customer_card_payment_completions: Object.freeze({
    alias: 'gc_payment_done',
    customerPredicate: 'gc_payment_done.customer_id = c.id',
    scopePredicates: Object.freeze([
      'gc_payment_done.ga_id = {{ga}}::integer',
    ]),
  }),
})

export function getCustomerGenericRelation(tableName) {
  return CUSTOMER_GENERIC_RELATIONS[String(tableName ?? '')] ?? null
}

export function listCustomerGenericRelationTables() {
  return Object.keys(CUSTOMER_GENERIC_RELATIONS)
}
