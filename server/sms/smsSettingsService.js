import { systemQuery } from '../utils/dbSafeQuery.js'
import {
  canStoreSmsCredentials,
  decryptSmsCredential,
  encryptSmsCredential,
  maskSmsCredential,
} from './smsCredentialsCrypto.js'
import { normalizeSenderNumber } from './smsPhone.js'
import { getSmsOutboundServerIpHint, readSmsModuleRuntimeInfo } from './smsModuleConfig.js'
import { loadActiveSmsProviderAccount } from './smsScope.js'

const ALIGO_API_SETTINGS_URL = 'https://smartsms.aligo.in/admin/api/auth.html'

function mapSettingsRow(row, apiKeyMasked) {
  const runtime = readSmsModuleRuntimeInfo()
  const base = {
    moduleEnabled: runtime.moduleEnabled,
    realSendEnabled: runtime.realSendEnabled,
    providerMode: runtime.mode,
    providerIsMock: runtime.isMock,
    usesGateway: runtime.usesGateway,
    providerMisconfigured: runtime.providerMisconfigured,
    aligoTestMode: runtime.testMode,
    outboundServerIpHint: getSmsOutboundServerIpHint(),
    aligoApiSettingsUrl: ALIGO_API_SETTINGS_URL,
  }
  if (!row) {
    return {
      configured: false,
      provider: 'aligo',
      aligoUserId: '',
      apiKeyMasked: null,
      defaultSender: '',
      isActive: false,
      lastBalanceCheckedAt: null,
      ...base,
    }
  }
  return {
    configured: true,
    provider: 'aligo',
    aligoUserId: String(row.provider_user_id ?? ''),
    apiKeyMasked,
    defaultSender: String(row.default_sender ?? ''),
    isActive: Boolean(row.is_active),
    lastBalanceCheckedAt: row.last_balance_checked_at ?? null,
    ...base,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 */
export async function getSmsSettings(executor, scope) {
  const row = await loadActiveSmsProviderAccount(executor, scope)
  let apiKeyMasked = null
  if (row?.api_key_encrypted) {
    try {
    apiKeyMasked = maskSmsCredential(decryptSmsCredential(String(row.api_key_encrypted)))
  } catch {
    apiKeyMasked = '********'
  }
  }
  return mapSettingsRow(row, apiKeyMasked)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 * @param {{ aligoUserId: string; apiKey?: string; defaultSender?: string }} input
 */
export async function upsertAligoSmsSettings(executor, scope, input) {
  if (!canStoreSmsCredentials()) {
    const err = new Error('sms_credential_storage_unavailable')
    err.status = 503
    err.publicMessage = 'API Key 저장 기능이 구성되지 않았습니다. 관리자에게 문의해 주세요.'
    throw err
  }
  const providerUserId = String(input.aligoUserId ?? '').trim()
  const apiKey = String(input.apiKey ?? '').trim()
  const defaultSender = normalizeSenderNumber(input.defaultSender ?? '') ?? ''

  if (!providerUserId) {
    const err = new Error('sms_aligo_user_required')
    err.status = 400
    err.publicMessage = '알리고 아이디를 입력해 주세요.'
    throw err
  }
  if (!defaultSender) {
    const err = new Error('sms_default_sender_required')
    err.status = 400
    err.publicMessage = '알리고에 등록된 발신번호를 입력해 주세요.'
    throw err
  }

  const existing = await loadActiveSmsProviderAccount(executor, scope)
  if (!existing && !apiKey) {
    const err = new Error('sms_api_key_required')
    err.status = 400
    err.publicMessage = 'API Key를 입력해 주세요.'
    throw err
  }

  let encrypted = existing?.api_key_encrypted ? String(existing.api_key_encrypted) : ''
  if (apiKey) {
    encrypted = encryptSmsCredential(apiKey)
  }
  if (!encrypted) {
    const err = new Error('sms_api_key_required')
    err.status = 400
    err.publicMessage = 'API Key를 입력해 주세요.'
    throw err
  }

  if (existing) {
    await systemQuery(
      executor,
      `
      UPDATE sms_provider_accounts
      SET provider_user_id = $3,
          api_key_encrypted = $4,
          default_sender = $5,
          is_active = true,
          updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND user_id = $6
      `,
      [existing.id, scope.tenantId, providerUserId, encrypted, defaultSender, scope.userId],
    )
  } else {
    await systemQuery(
      executor,
      `
      INSERT INTO sms_provider_accounts (
        tenant_id, user_id, provider, provider_user_id, api_key_encrypted, default_sender, is_active
      )
      VALUES ($1, $2, 'aligo', $3, $4, $5, true)
      `,
      [scope.tenantId, scope.userId, providerUserId, encrypted, defaultSender],
    )
  }

  if (defaultSender) {
    const account = await loadActiveSmsProviderAccount(executor, scope)
    if (account) {
      await ensureDefaultSenderRow(executor, scope, account.id, defaultSender)
    }
  }

  return getSmsSettings(executor, scope)
}

async function ensureDefaultSenderRow(executor, scope, providerAccountId, senderNumber) {
  const existing = await systemQuery(
    executor,
    `
    SELECT id, status FROM sms_sender_numbers
    WHERE tenant_id = $1 AND user_id = $2 AND sender_number = $3
    LIMIT 1
    `,
    [scope.tenantId, scope.userId, senderNumber],
  )

  if (existing.rowCount > 0) {
    const row = existing.rows[0]
    const rowId = Number(row.id)
    await systemQuery(
      executor,
      `
      UPDATE sms_sender_numbers
      SET is_default = true, updated_at = NOW()
      WHERE id = $1
      `,
      [rowId],
    )
    await systemQuery(
      executor,
      `
      UPDATE sms_sender_numbers
      SET is_default = false, updated_at = NOW()
      WHERE tenant_id = $1 AND user_id = $2 AND id <> $3
      `,
      [scope.tenantId, scope.userId, rowId],
    )
    return
  }

  await systemQuery(
    executor,
    `
    UPDATE sms_sender_numbers
    SET is_default = false, updated_at = NOW()
    WHERE tenant_id = $1 AND user_id = $2
    `,
    [scope.tenantId, scope.userId],
  )

  await systemQuery(
    executor,
    `
    INSERT INTO sms_sender_numbers (
      tenant_id, user_id, provider_account_id, sender_number, label, status, is_default
    )
    VALUES ($1, $2, $3, $4, '기본 발신번호', 'pending', true)
    `,
    [scope.tenantId, scope.userId, providerAccountId, senderNumber],
  )
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 */
export async function deleteAligoSmsSettings(executor, scope) {
  await systemQuery(
    executor,
    `
    UPDATE sms_provider_accounts
    SET is_active = false, updated_at = NOW()
    WHERE tenant_id = $1 AND user_id = $2 AND provider = 'aligo'
    `,
    [scope.tenantId, scope.userId],
  )
  return getSmsSettings(executor, scope)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 */
export async function loadDecryptedAligoCredentials(executor, scope) {
  const row = await loadActiveSmsProviderAccount(executor, scope)
  if (!row) {
    const err = new Error('sms_settings_not_configured')
    err.status = 400
    err.publicMessage = '알리고 계정 연동이 필요합니다. 문자 설정에서 API Key를 저장해 주세요.'
    throw err
  }
  const providerUserId = String(row.provider_user_id ?? '').trim()
  let apiKey = ''
  try {
    apiKey = decryptSmsCredential(String(row.api_key_encrypted ?? ''))
  } catch (e) {
    if (e?.status && e?.publicMessage) {
      throw e
    }
    const err = new Error('sms_api_key_decrypt_failed')
    err.status = 500
    err.publicMessage = '저장된 API Key를 불러올 수 없습니다. 다시 저장해 주세요.'
    throw err
  }
  if (!providerUserId || !apiKey) {
    const err = new Error('sms_settings_incomplete')
    err.status = 400
    err.publicMessage = '알리고 계정 정보가 완전하지 않습니다.'
    throw err
  }
  return {
    accountId: Number(row.id),
    providerUserId,
    apiKey,
    defaultSender: String(row.default_sender ?? ''),
  }
}
