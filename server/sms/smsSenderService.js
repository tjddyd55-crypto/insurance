import { systemQuery } from '../utils/dbSafeQuery.js'
import { normalizeSenderNumber, normalizeSmsPhone } from './smsPhone.js'
import {
  assertSmsModuleProductionProviderPolicy,
  assertSmsRealSendAllowed,
  canVerifySenderFromTestSend,
  readSmsModuleRuntimeInfo,
} from './smsModuleConfig.js'
import { resolveSmsProvider } from './smsProviderFactory.js'
import { assertOwnedSenderNumber, loadActiveSmsProviderAccount } from './smsScope.js'
import { loadDecryptedAligoCredentials } from './smsSettingsService.js'

function mapSenderRow(row) {
  return {
    id: Number(row.id),
    senderNumber: String(row.sender_number),
    label: String(row.label ?? ''),
    status: String(row.status),
    isDefault: Boolean(row.is_default),
    lastTestSentAt: row.last_test_sent_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 */
export async function listSmsSenders(executor, scope) {
  const r = await systemQuery(
    executor,
    `
    SELECT id, sender_number, label, status, is_default, last_test_sent_at, created_at, updated_at
    FROM sms_sender_numbers
    WHERE tenant_id = $1 AND user_id = $2
    ORDER BY is_default DESC, id ASC
    `,
    [scope.tenantId, scope.userId],
  )
  return r.rows.map(mapSenderRow)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 * @param {{ senderNumber: string; label?: string; isDefault?: boolean }} input
 */
export async function createSmsSender(executor, scope, input) {
  const account = await loadActiveSmsProviderAccount(executor, scope)
  if (!account) {
    const err = new Error('sms_settings_not_configured')
    err.status = 400
    err.publicMessage = '알리고 계정 연동 후 발신번호를 등록할 수 있습니다.'
    throw err
  }
  const senderNumber = normalizeSenderNumber(input.senderNumber)
  if (!senderNumber) {
    const err = new Error('sms_sender_invalid')
    err.status = 400
    err.publicMessage = '발신번호 형식이 올바르지 않습니다.'
    throw err
  }
  const label = String(input.label ?? '').trim() || senderNumber
  const ins = await systemQuery(
    executor,
    `
    INSERT INTO sms_sender_numbers (
      tenant_id, user_id, provider_account_id, sender_number, label, status, is_default
    )
    VALUES ($1, $2, $3, $4, $5, 'pending', $6)
    RETURNING id, sender_number, label, status, is_default, last_test_sent_at, created_at, updated_at
    `,
    [scope.tenantId, scope.userId, account.id, senderNumber, label, Boolean(input.isDefault)],
  )
  if (input.isDefault) {
    await systemQuery(
      executor,
      `
      UPDATE sms_sender_numbers SET is_default = false, updated_at = NOW()
      WHERE tenant_id = $1 AND user_id = $2 AND id <> $3
      `,
      [scope.tenantId, scope.userId, ins.rows[0].id],
    )
  }
  return mapSenderRow(ins.rows[0])
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string; senderId: number }} scope
 * @param {{ label?: string; isDefault?: boolean; status?: string }} patch
 */
export async function patchSmsSender(executor, scope, patch) {
  const existing = await systemQuery(
    executor,
    `
    SELECT id FROM sms_sender_numbers
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3
    LIMIT 1
    `,
    [scope.senderId, scope.tenantId, scope.userId],
  )
  if (existing.rowCount === 0) {
    const err = new Error('sms_sender_not_found')
    err.status = 404
    throw err
  }
  const label = patch.label != null ? String(patch.label).trim() : null
  const status = patch.status != null ? String(patch.status).trim() : null
  if (status === 'verified' || status === 'test_passed') {
    const err = new Error('sms_sender_status_forbidden')
    err.status = 403
    err.publicMessage = '발신번호 검증 상태는 테스트 발송 검증을 통해서만 변경됩니다.'
    throw err
  }
  if (status && !['pending', 'disabled'].includes(status)) {
    const err = new Error('sms_sender_status_invalid')
    err.status = 400
    throw err
  }
  await systemQuery(
    executor,
    `
    UPDATE sms_sender_numbers
    SET label = COALESCE($4, label),
        status = COALESCE($5, status),
        is_default = COALESCE($6, is_default),
        updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3
    `,
    [
      scope.senderId,
      scope.tenantId,
      scope.userId,
      label,
      status,
      patch.isDefault == null ? null : Boolean(patch.isDefault),
    ],
  )
  if (patch.isDefault) {
    await systemQuery(
      executor,
      `
      UPDATE sms_sender_numbers SET is_default = false, updated_at = NOW()
      WHERE tenant_id = $1 AND user_id = $2 AND id <> $3
      `,
      [scope.tenantId, scope.userId, scope.senderId],
    )
  }
  const r = await systemQuery(
    executor,
    `
    SELECT id, sender_number, label, status, is_default, last_test_sent_at, created_at, updated_at
    FROM sms_sender_numbers WHERE id = $1
    `,
    [scope.senderId],
  )
  return mapSenderRow(r.rows[0])
}

export async function deleteSmsSender(executor, scope) {
  const r = await systemQuery(
    executor,
    `
    DELETE FROM sms_sender_numbers
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3
    RETURNING id
    `,
    [scope.senderId, scope.tenantId, scope.userId],
  )
  if (r.rowCount === 0) {
    const err = new Error('sms_sender_not_found')
    err.status = 404
    throw err
  }
  return { deleted: true }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 * @param {{ senderNumber: string; receiver: string; message: string; verifyOnSuccess?: boolean }} input
 */
export async function testSmsSend(executor, scope, input) {
  const senderNumber = normalizeSenderNumber(input.senderNumber)
  const receiver = normalizeSmsPhone(input.receiver)
  const message = String(input.message ?? '').trim()
  if (!senderNumber || !receiver || !message) {
    const err = new Error('sms_test_input_invalid')
    err.status = 400
    err.publicMessage = '발신번호, 수신번호, 메시지를 모두 입력해 주세요.'
    throw err
  }
  await assertOwnedSenderNumber(executor, {
    tenantId: scope.tenantId,
    userId: scope.userId,
    senderNumber,
    requireVerified: false,
  })
  assertSmsRealSendAllowed()
  const runtime = readSmsModuleRuntimeInfo()
  const creds = await loadDecryptedAligoCredentials(executor, scope)
  const provider = resolveSmsProvider()
  const result = await provider.send({
    to: receiver,
    from: senderNumber,
    message,
    providerUserId: creds.providerUserId,
    apiKey: creds.apiKey,
  })
  if (!result.success) {
    return {
      success: false,
      errorMessage: result.errorMessage ?? '테스트 발송에 실패했습니다.',
      errorCode: result.errorCode ?? null,
      providerMode: runtime.mode,
      mockMode: runtime.isMock,
      testMode: runtime.testMode || result.testMode === true,
    }
  }

  let nextStatus = 'pending'
  if (canVerifySenderFromTestSend(runtime) && result.testMode !== true) {
    nextStatus = 'verified'
  } else if (runtime.isMock) {
    nextStatus = 'pending'
  } else if (runtime.testMode || result.testMode === true) {
    nextStatus = 'test_passed'
  }

  await systemQuery(
    executor,
    `
    UPDATE sms_sender_numbers
    SET status = $4,
        last_test_sent_at = NOW(),
        updated_at = NOW()
    WHERE tenant_id = $1 AND user_id = $2 AND sender_number = $3
    `,
    [scope.tenantId, scope.userId, senderNumber, nextStatus],
  )

  return {
    success: true,
    providerMessageId: result.providerMessageId ?? null,
    senderStatus: nextStatus,
    verifiedApplied: nextStatus === 'verified',
    providerMode: runtime.mode,
    mockMode: runtime.isMock,
    testMode: runtime.testMode || result.testMode === true,
    notice:
      nextStatus === 'verified'
        ? '발신번호가 검증되었습니다.'
        : runtime.isMock
          ? 'mock provider 테스트입니다. 실제 발송·verified 처리는 되지 않습니다.'
          : nextStatus === 'test_passed'
            ? '테스트 모드 발송 성공입니다. verified 전환은 실발송(testmode off) 검증 후 가능합니다.'
            : '테스트 발송 결과를 저장했습니다.',
  }
}

export async function getSmsBalance(executor, scope) {
  assertSmsModuleProductionProviderPolicy()
  const creds = await loadDecryptedAligoCredentials(executor, scope)
  const provider = resolveSmsProvider()
  const result = await provider.getBalance({
    providerUserId: creds.providerUserId,
    apiKey: creds.apiKey,
  })
  if (result.success) {
    await systemQuery(
      executor,
      `
      UPDATE sms_provider_accounts
      SET last_balance_checked_at = NOW(), updated_at = NOW()
      WHERE tenant_id = $1 AND user_id = $2 AND provider = 'aligo' AND is_active = true
      `,
      [scope.tenantId, scope.userId],
    )
  }
  return result
}
