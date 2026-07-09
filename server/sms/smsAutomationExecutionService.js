import { getKstDateString } from '../../shared/dateTimeKst.js'
import { isSmsRealSendEnabled } from './smsModuleConfig.js'
import { previewAutomationRule } from './smsAutomationPreviewService.js'
import { sendAutomationSms } from './smsAutomationSenderAdapter.js'
import {
  createAutomationRun,
  finalizeAutomationRun,
  getAutomationRunDetail,
  insertAutomationRunItem,
  listAutomationRuns,
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
      if (!item.sendable) {
        await insertAutomationRunItem(executor, {
          runId: run.id,
          tenantId: scope.tenantId,
          gaId: run.gaId,
          userId: scope.userId,
          ruleId,
          triggerType: preview.rule.triggerType,
          item,
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
        item,
        sendStatus: 'SIMULATED',
      })

      const dedupeId = await tryInsertAutomationSendDedupe(executor, {
        tenantId: scope.tenantId,
        gaId: run.gaId,
        userId: scope.userId,
        ruleId,
        customerId: Number(item.customerId),
        triggerInstanceKey: String(item.triggerInstanceKey ?? ''),
        referenceDate: String(item.referenceDate ?? preview.targetDate),
        runItemId: runItem.id,
      })

      if (dedupeId == null) {
        counts.skippedDuplicate += 1
        await systemQuery(
          executor,
          `
          UPDATE sms_automation_run_items
          SET send_status = 'SKIPPED_DUPLICATE',
              send_result_message = '이미 동일 기준으로 발송(또는 모의 실행)된 대상입니다.',
              updated_at = NOW()
          WHERE id = $1
          `,
          [runItem.id],
        )
        continue
      }

      if (runMode === 'SIMULATED_SEND') {
        counts.simulated += 1
        continue
      }

      try {
        const sendResult = await sendAutomationSms(executor, scope, {
          customerId: Number(item.customerId),
          phone: String(item.phone ?? ''),
          messageBody: String(item.messageBody ?? ''),
        })
        if (sendResult.success) {
          counts.sent += 1
          await systemQuery(
            executor,
            `
            UPDATE sms_automation_run_items
            SET send_status = 'SENT',
                send_result_code = 'success',
                send_result_message = NULL,
                sent_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
            `,
            [runItem.id],
          )
        } else {
          counts.failed += 1
          await systemQuery(
            executor,
            `
            UPDATE sms_automation_run_items
            SET send_status = 'FAILED',
                send_result_code = 'provider_failed',
                send_result_message = $2,
                updated_at = NOW()
            WHERE id = $1
            `,
            [runItem.id, sendResult.errorMessage ?? '발송 실패'],
          )
        }
      } catch (sendErr) {
        counts.failed += 1
        await systemQuery(
          executor,
          `
          UPDATE sms_automation_run_items
          SET send_status = 'FAILED',
              send_result_code = $2,
              send_result_message = $3,
              updated_at = NOW()
          WHERE id = $1
          `,
          [
            runItem.id,
            String(sendErr?.message ?? 'send_failed'),
            String(sendErr?.publicMessage ?? sendErr?.message ?? '발송 실패'),
          ],
        )
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
