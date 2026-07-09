import { systemQuery } from '../utils/dbSafeQuery.js'

function mapRunRow(row) {
  return {
    id: Number(row.id),
    tenantId: Number(row.tenant_id),
    gaId: row.ga_id != null ? Number(row.ga_id) : null,
    userId: String(row.user_id),
    ruleId: Number(row.rule_id),
    runType: String(row.run_type),
    runMode: String(row.run_mode),
    baseDate: String(row.base_date),
    targetDate: String(row.target_date),
    scheduledSendTime: String(row.scheduled_send_time ?? '').slice(0, 5),
    status: String(row.status),
    totalCount: Number(row.total_count ?? 0),
    sendableCount: Number(row.sendable_count ?? 0),
    excludedCount: Number(row.excluded_count ?? 0),
    successCount: Number(row.success_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    skippedDuplicateCount: Number(row.skipped_duplicate_count ?? 0),
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
    finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
    errorMessage: row.error_message != null ? String(row.error_message) : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

function mapRunItemRow(row) {
  return {
    id: Number(row.id),
    runId: Number(row.run_id),
    tenantId: Number(row.tenant_id),
    gaId: row.ga_id != null ? Number(row.ga_id) : null,
    userId: String(row.user_id),
    ruleId: Number(row.rule_id),
    customerId: row.customer_id != null ? Number(row.customer_id) : null,
    phone: String(row.phone ?? ''),
    customerName: String(row.customer_name ?? ''),
    triggerType: String(row.trigger_type),
    referenceType: row.reference_type != null ? String(row.reference_type) : null,
    referenceId: row.reference_id != null ? Number(row.reference_id) : null,
    referenceTitle: row.reference_title != null ? String(row.reference_title) : null,
    referenceDate: row.reference_date != null ? String(row.reference_date).slice(0, 10) : null,
    triggerInstanceKey: String(row.trigger_instance_key ?? ''),
    messageBody: String(row.message_body ?? ''),
    sendable: row.sendable === true,
    excludedReason: row.excluded_reason != null ? String(row.excluded_reason) : null,
    sendStatus: String(row.send_status),
    sendResultCode: row.send_result_code != null ? String(row.send_result_code) : null,
    sendResultMessage: row.send_result_message != null ? String(row.send_result_message) : null,
    sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{
 *   tenantId: number;
 *   gaId?: number | null;
 *   userId: string;
 *   ruleId: number;
 *   runType: 'MANUAL' | 'SCHEDULED';
 *   runMode: 'DRY_RUN' | 'REAL_SEND' | 'SIMULATED_SEND';
 *   baseDate: string;
 *   targetDate: string;
 *   scheduledSendTime: string;
 *   summary: { total: number; sendable: number; excluded: number };
 * }} input
 */
export async function createAutomationRun(executor, input) {
  const r = await systemQuery(
    executor,
    `
    INSERT INTO sms_automation_runs (
      tenant_id, ga_id, user_id, rule_id, run_type, run_mode,
      base_date, target_date, scheduled_send_time, status,
      total_count, sendable_count, excluded_count,
      success_count, failed_count, skipped_duplicate_count,
      started_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, 'RUNNING', $10, $11, $12, 0, 0, 0, NOW())
    RETURNING *
    `,
    [
      input.tenantId,
      input.gaId ?? null,
      input.userId,
      input.ruleId,
      input.runType,
      input.runMode,
      input.baseDate,
      input.targetDate,
      input.scheduledSendTime,
      input.summary.total,
      input.summary.sendable,
      input.summary.excluded,
    ],
  )
  return mapRunRow(r.rows[0])
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {number} runId
 * @param {{
 *   status: string;
 *   successCount: number;
 *   failedCount: number;
 *   skippedDuplicateCount: number;
 *   errorMessage?: string | null;
 * }} patch
 */
export async function finalizeAutomationRun(executor, runId, patch) {
  const r = await systemQuery(
    executor,
    `
    UPDATE sms_automation_runs
    SET status = $2,
        success_count = $3,
        failed_count = $4,
        skipped_duplicate_count = $5,
        error_message = $6,
        finished_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      runId,
      patch.status,
      patch.successCount,
      patch.failedCount,
      patch.skippedDuplicateCount,
      patch.errorMessage ?? null,
    ],
  )
  return mapRunRow(r.rows[0])
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{
 *   runId: number;
 *   tenantId: number;
 *   gaId?: number | null;
 *   userId: string;
 *   ruleId: number;
 *   triggerType: string;
 *   item: Record<string, unknown>;
 *   sendStatus: string;
 *   sendResultCode?: string | null;
 *   sendResultMessage?: string | null;
 *   sentAt?: Date | null;
 * }} input
 */
export async function insertAutomationRunItem(executor, input) {
  const item = input.item
  const r = await systemQuery(
    executor,
    `
    INSERT INTO sms_automation_run_items (
      run_id, tenant_id, ga_id, user_id, rule_id, customer_id, phone, customer_name,
      trigger_type, reference_type, reference_id, reference_title, reference_date,
      trigger_instance_key, message_body, sendable, excluded_reason, send_status,
      send_result_code, send_result_message, sent_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13::date,
      $14, $15, $16, $17, $18,
      $19, $20, $21
    )
    RETURNING *
    `,
    [
      input.runId,
      input.tenantId,
      input.gaId ?? null,
      input.userId,
      input.ruleId,
      item.customerId ?? null,
      item.phone ?? '',
      item.customerName ?? '',
      input.triggerType,
      item.referenceType ?? null,
      item.referenceId ?? null,
      item.referenceTitle ?? null,
      item.referenceDate ?? null,
      item.triggerInstanceKey ?? '',
      item.messageBody ?? '',
      item.sendable === true,
      item.excludedReason ?? null,
      input.sendStatus,
      input.sendResultCode ?? null,
      input.sendResultMessage ?? null,
      input.sentAt ?? null,
    ],
  )
  return mapRunItemRow(r.rows[0])
}

/**
 * dedupe insert — unique conflict 시 null 반환
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{
 *   tenantId: number;
 *   gaId?: number | null;
 *   userId: string;
 *   ruleId: number;
 *   customerId: number;
 *   triggerInstanceKey: string;
 *   referenceDate: string;
 *   runItemId: number;
 * }} input
 * @returns {Promise<number | null>} dedupe id or null on conflict
 */
export async function tryInsertAutomationSendDedupe(executor, input) {
  try {
    const r = await systemQuery(
      executor,
      `
      INSERT INTO sms_automation_send_dedupes (
        tenant_id, ga_id, user_id, rule_id, customer_id,
        trigger_instance_key, reference_date, run_item_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8)
      RETURNING id
      `,
      [
        input.tenantId,
        input.gaId ?? null,
        input.userId,
        input.ruleId,
        input.customerId,
        input.triggerInstanceKey,
        input.referenceDate,
        input.runItemId,
      ],
    )
    return Number(r.rows[0].id)
  } catch (e) {
    if (String(e?.code) === '23505') {
      return null
    }
    throw e
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string; ruleId?: number; dateFrom?: string; dateTo?: string; status?: string; limit?: number; offset?: number }} params
 */
export async function listAutomationRuns(executor, params) {
  const values = [params.tenantId, params.userId]
  const clauses = ['tenant_id = $1', 'user_id = $2']
  if (params.ruleId != null) {
    values.push(Number(params.ruleId))
    clauses.push(`rule_id = $${values.length}`)
  }
  if (params.status) {
    values.push(String(params.status))
    clauses.push(`status = $${values.length}`)
  }
  if (params.dateFrom) {
    values.push(String(params.dateFrom))
    clauses.push(`base_date >= $${values.length}::date`)
  }
  if (params.dateTo) {
    values.push(String(params.dateTo))
    clauses.push(`base_date <= $${values.length}::date`)
  }
  const limit = Math.min(Math.max(Number(params.limit ?? 50), 1), 200)
  const offset = Math.max(Number(params.offset ?? 0), 0)
  values.push(limit, offset)
  const r = await systemQuery(
    executor,
    `
    SELECT *
    FROM sms_automation_runs
    WHERE ${clauses.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT $${values.length - 1} OFFSET $${values.length}
    `,
    values,
  )
  return r.rows.map(mapRunRow)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string; runId: number }} params
 */
export async function getAutomationRunDetail(executor, params) {
  const runRes = await systemQuery(
    executor,
    `
    SELECT *
    FROM sms_automation_runs
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3
    LIMIT 1
    `,
    [params.runId, params.tenantId, params.userId],
  )
  const runRow = runRes.rows[0]
  if (!runRow) {
    return null
  }
  const itemsRes = await systemQuery(
    executor,
    `
    SELECT *
    FROM sms_automation_run_items
    WHERE run_id = $1
    ORDER BY id ASC
    `,
    [params.runId],
  )
  return {
    run: mapRunRow(runRow),
    items: itemsRes.rows.map(mapRunItemRow),
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ ruleId: number; runDate: string; sendTime: string }} input
 * @returns {Promise<boolean>} true if lock acquired
 */
export async function tryAcquireSchedulerLock(executor, input) {
  try {
    await systemQuery(
      executor,
      `
      INSERT INTO sms_automation_scheduler_locks (rule_id, run_date, send_time)
      VALUES ($1, $2::date, $3)
      `,
      [input.ruleId, input.runDate, input.sendTime],
    )
    return true
  } catch (e) {
    if (String(e?.code) === '23505') {
      return false
    }
    throw e
  }
}

export { mapRunRow, mapRunItemRow }
