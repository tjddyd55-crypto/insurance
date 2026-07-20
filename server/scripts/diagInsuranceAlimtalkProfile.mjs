/**
 * Safe Aligo Kakao profile/list diagnostics — no secret prints.
 * Usage (Railway prod, dry credentials from env):
 *   railway run --service app --environment production -- node server/scripts/diagInsuranceAlimtalkProfile.mjs
 */
import { createHash } from 'node:crypto'
import { loadInsuranceAlimtalkConfig } from '../alimtalk/alimtalkConfig.js'
import { checkInsuranceAlimtalkProfileList } from '../alimtalk/alimtalkProfileDiagnostics.js'

function fp(value) {
  const s = String(value ?? '')
  if (!s) return null
  return createHash('sha256').update(s).digest('hex').slice(0, 8)
}

function maskSender(sender) {
  const digits = String(sender ?? '').replace(/\D/g, '')
  if (digits.length < 4) return '****'
  return `****${digits.slice(-4)}`
}

const config = loadInsuranceAlimtalkConfig()
const diag = {
  credentials: Boolean(config.apiKey && config.userId && config.senderKey && config.sender),
  apiKeyConfigured: Boolean(config.apiKey),
  userIdConfigured: Boolean(config.userId),
  senderKeyConfigured: Boolean(config.senderKey),
  senderConfigured: Boolean(config.sender),
  apiKeyLen: config.apiKey.length,
  userIdLen: config.userId.length,
  senderKeyLen: config.senderKey.length,
  apiKeyFp: fp(config.apiKey),
  userIdFp: fp(config.userId),
  senderKeyFp: fp(config.senderKey),
  senderMasked: maskSender(config.sender),
  dryRun: config.dryRun,
  allowRealSend: config.allowRealSend,
  testMode: config.testMode,
  customerAppApproved: config.customerAppLinkApproved,
  customerRegistrationApproved: config.customerRegistrationLinkApproved,
  sendUrl: config.sendUrl,
  profileListUrl: config.profileListUrl,
  provider: config.provider,
}

console.log('[alimtalk-diag] config', JSON.stringify(diag, null, 2))

const profile = await checkInsuranceAlimtalkProfileList({ config })
console.log(
  '[alimtalk-diag] profile/list',
  JSON.stringify(
    {
      ok: profile.ok,
      code: profile.code,
      message: profile.message,
      listCount: Array.isArray(profile.list) ? profile.list.length : 0,
      senderKeyMatch: profile.senderKeyMatch,
      // channel names only — no senderkey values
      channels: (profile.list || [])
        .slice(0, 10)
        .map((item) => ({
          name: item?.name != null ? String(item.name) : null,
          status: item?.status != null ? String(item.status) : null,
          hasSenderkey: Boolean(item?.senderkey),
        })),
    },
    null,
    2,
  ),
)
