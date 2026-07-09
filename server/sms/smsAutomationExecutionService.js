import { getKstDateString } from '../../shared/dateTimeKst.js'
import { isSmsRealSendEnabled } from './smsModuleConfig.js'
import { previewAutomationRule } from './smsAutomationPreviewService.js'
import { sendAutomationSms } from './smsAutomationSenderAdapter.js'
import {
  createAutomationRun,
  finalizeAutomationRun,
  getAutomationRunDetail,
  hasAutomationSendDedupe,
  insertAutomationRunItem,
  listAutomationRuns,
  normalizeDateOrNull,
  tryInsertAutomationSendDedupe,
} from './smsAutomationRunRepository.js'
import { systemQuery } from '../utils/dbSafeQuery.js'

function normalizeBaseDate(raw) {
  const value = String(raw ?? '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return getKstDateString()
  }
  return value
}

/**
 * @param {{ realSend?: boolean }} options
 * @returns {'REAL_SEND' | 'SIMULATED_SEND'}
 */
export function resolveAutomationRunMode(options = {}) {
  const wantsRealSend = options.realSend === true
  if (wantsRealSend && isSmsRealSendEnabled()) {
    return 'REAL_SEND'
  }
  return 'SIMULATED_SEND'
}

function buildRunSummary(counts) {
  return {
    total: counts.total,
    sendable: counts.sendable,
    excluded: counts.excluded,
    sent: counts.sent,
    simulated: counts.simulated,
    failed: counts.failed,
    skippedDuplicate: counts.skippedDuplicate,
  }
}

function resolveRunStatus(counts) {
  if (counts.failed > 0 && (counts.sent > 0 || counts.simulated > 0)) {
    return 'PARTIAL_FAILED'
  }
  if (counts.failed > 0) {
    return 'FAILED'
  }
  return 'COMPLETED'
}

const DUPLICATE_SKIP_MESSAGE = '이미 동일 기준으로 실제 발송된 대상입니다.'
const DUPLICATE_SIMULATED_NOTE = '기존 실제 발송 기록이 있어 모의 실행에서도 중복으로 표시됩니다.'

/**
 * sendable 대상 1건 처리 — dedupe 정책 SSOT
 * SIMULATED_SEND: dedupe insert 금지, 기존 dedupe만 조회
 * REAL_SEND: dedupe insert 후 발송 (실패해도 dedupe 유지 — A안)
 *
 * @param {'REAL_SEND' | 'SIMULATED_SEND'} runMode
 * @param {{
 *   hasDedupe: () => Promise<boolean>;
 *   tryInsertDedupe: () => Promise<number | null>;
 *   sendSms: () => Promise<{ success: boolean; errorMessage?: string | null }>;
 * }} deps
 */
export async function processSendableAutomationTarget(runMode, deps) {
  if (runMode === 'SIMULATED_SEND') {
    const alreadySent = await deps.hasDedupe()
    if (alreadySent) {
      return {
        sendStatus: 'SKIPPED_DUPLICATE',
        sendResultCode: 'duplicate_existing',
        sendResultMessage: DUPLICATE_SIMULATED_NOTE,
        dedupeInserted: false,
        outcome: 'skippedDuplicate',
      }
    }
    return {
      sendStatus: 'SIMULATED',
      sendResultCode: null,
      sendResultMessage: null,
      dedupeInserted: false,
      outcome: 'simulated',
    }
  }

  const dedupeId = await deps.tryInsertDedupe()
  if (dedupeId == null) {
    return {
      sendStatus: 'SKIPPED_DUPLICATE',
      sendResultCode: 'duplicate_conflict',
      sendResultMessage: DUPLICATE_SKIP_MESSAGE,
      dedupeInserted: false,
      outcome: 'skippedDuplicate',
    }
  }

  try {
    const sendResult = await deps.sendSms()
    if (sendResult.success) {
      return {
        sendStatus: 'SENT',
        sendResultCode: 'success',
        sendResultMessage: null,
        dedupeInserted: true,
        outcome: 'sent',
        sentAt: new Date(),
      }
    }
    return {
      sendStatus: 'FAILED',
      sendResultCode: 'provider_failed',
      sendResultMessage: sendResult.errorMessage ?? '발송 실패',
      dedupeInserted: true,
      outcome: 'failed',
    }
  } catch (sendErr) {
    return {
      sendStatus: 'FAILED',
      sendResultCode: String(sendErr?.message ?? 'send_failed'),
      sendResultMessage: String(sendErr?.publicMessage ?? sendErr?.message ?? '발송 실패'),
      dedupeInserted: true,
      outcome: 'failed',
    }
  }
}

async function updateAutomationRunItemStatus(executor, runItemId, patch) {
  await systemQuery(
    executor,
    `
    UPDATE sms_automation_run_items
    SET send_status = $2,
        send_result_code = $3,
        send_result_message = $4,
        sent_at = $5,
        updated_at = NOW()
    WHERE id = $1
    `,
    [
      runItemId,
      patch.sendStatus,
      patch.sendResultCode ?? null,
      patch.sendResultMessage ?? null,
      patch.sentAt ?? null,
    ],
  )
}

export function normalizeExecutionItem(item) {
  return {
    ...item,
    referenceDate: normalizeDateOrNull(item.referenceDate),
    phone: String(item.phone ?? '').trim(),
    customerName: String(item.customerName ?? '').trim() || '고객',
    referenceTitle:
      item.referenceTitle != null && String(item.referenceTitle).trim()
        ? String(item.referenceTitle).trim()
        : null,
    referenceId:
      item.referenceId != null && Number.isInteger(Number(item.referenceId))
        ? Number(item.referenceId)
        : null,
  }
}

async function loadRuleScopeRow(executor, scope, ruleId) {
  const r = await systemQuery(
    executor,
    `
    SELECT id, ga_id, send_time, trigger_type, is_active
    FROM sms_automation_rules
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND deleted_at IS NULL
    LIMIT 1
    `,
    [ruleId, scope.tenantId, scope.userId],
  )
  return r.rows[0] ?? null
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string; gaId?: number | null }} scope
 * @param {number} ruleId
 * @param {{
 *   baseDate?: string | null;
 *   realSend?: boolean;
 *   runType?: 'MANUAL' | 'SCHEDULED';
 * }} [options]
 */
export async function runAutomationRule(executor, scope, ruleId, options = {}) {
  const ruleRow = await loadRuleScopeRow(executor, scope, ruleId)
  if (!ruleRow) {
    const err = new Error('sms_automation_rule_not_found')
    err.status = 404
    err.publicMessage = '자동문자 규칙을 찾을 수 없습니다.'
    throw err
  }

  const baseDate = normalizeBaseDate(options.baseDate)
  const preview = await previewAutomationRule(executor, scope, ruleId, { baseDate })
  const runMode = resolveAutomationRunMode(options)
  const runType = options.runType === 'SCHEDULED' ? 'SCHEDULED' : 'MANUAL'

  const run = await createAutomationRun(executor, {
    tenantId: scope.tenantId,
    gaId: scope.gaId ?? (ruleRow.ga_id != null ? Number(ruleRow.ga_id) : null),
    userId: scope.userId,
    ruleId,
    runType,
    runMode,
    baseDate: preview.baseDate,
    targetDate: preview.targetDate,
    scheduledSendTime: String(ruleRow.send_time ?? '10:00').slice(0, 5),
    summary: preview.summary,
  })

  const counts = {
    total: preview.summary.total,
    sendable: preview.summary.sendable,
    excluded: preview.summary.excluded,
    sent: 0,
    simulated: 0,
    failed: 0,
    skippedDuplicate: 0,
  }

  try {
    for (const item of preview.items) {
      const executionItem = normalizeExecutionItem(item)

      if (!item.sendable) {
        await insertAutomationRunItem(executor, {
          runId: run.id,
          tenantId: scope.tenantId,
          gaId: run.gaId,
          userId: scope.userId,
          ruleId,
          triggerType: preview.rule.triggerType,
          item: executionItem,
          sendStatus: 'EXCLUDED',
        })
        continue
      }

      const runItem = await insertAutomationRunItem(executor, {
        runId: run.id,
        tenantId: scope.tenantId,
        gaId: run.gaId,
        userId: scope.userId,
        ruleId,
        triggerType: preview.rule.triggerType,
        item: executionItem,
        sendStatus: runMode === 'REAL_SEND' ? 'FAILED' : 'SIMULATED',
      })

      const referenceDate = executionItem.referenceDate ?? normalizeDateOrNull(preview.targetDate)
      const dedupeKey = {
        ruleId,
        customerId: Number(executionItem.customerId),
        triggerInstanceKey: String(executionItem.triggerInstanceKey ?? ''),
        referenceDate,
      }

      const outcome = await processSendableAutomationTarget(runMode, {
        hasDedupe: () => hasAutomationSendDedupe(executor, dedupeKey),
        tryInsertDedupe: () =>
          tryInsertAutomationSendDedupe(executor, {
            tenantId: scope.tenantId,
            gaId: run.gaId,
            userId: scope.userId,
            ruleId,
            customerId: dedupeKey.customerId,
            triggerInstanceKey: dedupeKey.triggerInstanceKey,
            referenceDate: dedupeKey.referenceDate,
            runItemId: runItem.id,
          }),
        sendSms: () =>
          sendAutomationSms(executor, scope, {
            customerId: dedupeKey.customerId,
            phone: String(executionItem.phone ?? ''),
            messageBody: String(executionItem.messageBody ?? ''),
          }),
      })

      await updateAutomationRunItemStatus(executor, runItem.id, outcome)

      if (outcome.outcome === 'skippedDuplicate') {
        counts.skippedDuplicate += 1
      } else if (outcome.outcome === 'simulated') {
        counts.simulated += 1
      } else if (outcome.outcome === 'sent') {
        counts.sent += 1
      } else if (outcome.outcome === 'failed') {
        counts.failed += 1
      }
    }

    const finalized = await finalizeAutomationRun(executor, run.id, {
      status: resolveRunStatus(counts),
      successCount: counts.sent + counts.simulated,
      failedCount: counts.failed,
      skippedDuplicateCount: counts.skippedDuplicate,
      errorMessage: null,
    })

    return {
      runId: finalized.id,
      mode: runMode,
      runType,
      realSendEnabled: isSmsRealSendEnabled(),
      summary: buildRunSummary(counts),
      run: finalized,
    }
  } catch (e) {
    await finalizeAutomationRun(executor, run.id, {
      status: 'FAILED',
      successCount: counts.sent + counts.simulated,
      failedCount: counts.failed,
      skippedDuplicateCount: counts.skippedDuplicate,
      errorMessage: String(e?.publicMessage ?? e?.message ?? 'execution_failed'),
    })
    throw e
  }
}

export async function listAutomationRunSummaries(executor, scope, query = {}) {
  return listAutomationRuns(executor, {
    tenantId: scope.tenantId,
    userId: scope.userId,
    ruleId: query.ruleId != null ? Number(query.ruleId) : undefined,
    dateFrom: query.dateFrom ?? query.date_from ?? undefined,
    dateTo: query.dateTo ?? query.date_to ?? undefined,
    status: query.status ?? undefined,
    limit: query.limit,
    offset: query.offset,
  })
}

export async function getAutomationRunSummaryDetail(executor, scope, runId) {
  const detail = await getAutomationRunDetail(executor, {
    tenantId: scope.tenantId,
    userId: scope.userId,
    runId: Number(runId),
  })
  if (!detail) {
    const err = new Error('sms_automation_run_not_found')
    err.status = 404
    err.publicMessage = '자동문자 실행 로그를 찾을 수 없습니다.'
    throw err
  }
  return detail
}
