/**
 * DEV 카카오 알림톡 실수신 QA env toggle (비밀값 로그 금지).
 * Usage:
 *   node server/scripts/devKakaoRealSendQaEnv.mjs enable
 *   node server/scripts/devKakaoRealSendQaEnv.mjs disable
 *   node server/scripts/devKakaoRealSendQaEnv.mjs status
 */
import { execSync } from 'node:child_process'

const MODE = String(process.argv[2] ?? 'status').trim().toLowerCase()
const TEST_PHONE = '01022221382'
const COPY_FROM_PROD = [
  'INSURANCE_ALIGO_KAKAO_API_KEY',
  'INSURANCE_ALIGO_KAKAO_USER_ID',
  'INSURANCE_ALIGO_KAKAO_SENDER_KEY',
  'INSURANCE_ALIGO_KAKAO_SENDER',
  'INSURANCE_ALIGO_KAKAO_TPL_CUSTOMER_APP_LINK',
  'INSURANCE_ALIGO_KAKAO_TPL_CUSTOMER_REGISTRATION_LINK',
]

const ENABLE_VARS = {
  INSURANCE_ALIGO_KAKAO_DRY_RUN: 'false',
  INSURANCE_ALIGO_KAKAO_ALLOW_REAL_SEND: 'true',
  INSURANCE_ALIGO_KAKAO_CUSTOMER_APP_LINK_APPROVED: 'true',
  INSURANCE_ALIGO_KAKAO_CUSTOMER_REGISTRATION_LINK_APPROVED: 'true',
  INSURANCE_ALIGO_KAKAO_DEV_REAL_SEND_ENABLED: 'true',
  INSURANCE_ALIGO_KAKAO_DEV_RECIPIENT_ALLOWLIST: TEST_PHONE,
  INSURANCE_ALIMTALK_PROVIDER: 'aligo',
  INSURANCE_ALIGO_KAKAO_TEST_MODE: 'N',
}

const DISABLE_VARS = {
  INSURANCE_ALIGO_KAKAO_DRY_RUN: 'true',
  INSURANCE_ALIGO_KAKAO_ALLOW_REAL_SEND: 'false',
  INSURANCE_ALIGO_KAKAO_CUSTOMER_APP_LINK_APPROVED: 'false',
  INSURANCE_ALIGO_KAKAO_CUSTOMER_REGISTRATION_LINK_APPROVED: 'false',
  INSURANCE_ALIGO_KAKAO_DEV_REAL_SEND_ENABLED: 'false',
  INSURANCE_ALIGO_KAKAO_DEV_RECIPIENT_ALLOWLIST: '',
}

const DISABLE_DELETE_KEYS = [
  'INSURANCE_ALIGO_KAKAO_API_KEY',
  'INSURANCE_ALIGO_KAKAO_USER_ID',
  'INSURANCE_ALIGO_KAKAO_SENDER_KEY',
]

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
}

function readVars(environment) {
  const raw = sh(`railway variables --json -e ${environment} -s app`)
  return JSON.parse(raw)
}

function setDevVars(pairs) {
  for (const [key, value] of Object.entries(pairs)) {
    sh(`railway variable set ${key}=${value} -e development -s app --json`)
  }
}

function safeStatus(vars) {
  return {
    dryRun: vars.INSURANCE_ALIGO_KAKAO_DRY_RUN ?? null,
    allowRealSend: vars.INSURANCE_ALIGO_KAKAO_ALLOW_REAL_SEND ?? null,
    devRealSendEnabled: vars.INSURANCE_ALIGO_KAKAO_DEV_REAL_SEND_ENABLED ?? null,
    allowlist: vars.INSURANCE_ALIGO_KAKAO_DEV_RECIPIENT_ALLOWLIST ?? null,
    appApproved: vars.INSURANCE_ALIGO_KAKAO_CUSTOMER_APP_LINK_APPROVED ?? null,
    registrationApproved: vars.INSURANCE_ALIGO_KAKAO_CUSTOMER_REGISTRATION_LINK_APPROVED ?? null,
    provider: vars.INSURANCE_ALIMTALK_PROVIDER ?? null,
    apiKey: vars.INSURANCE_ALIGO_KAKAO_API_KEY ? `present(len=${String(vars.INSURANCE_ALIGO_KAKAO_API_KEY).length})` : 'missing',
    userId: vars.INSURANCE_ALIGO_KAKAO_USER_ID ? `present(len=${String(vars.INSURANCE_ALIGO_KAKAO_USER_ID).length})` : 'missing',
    senderKey: vars.INSURANCE_ALIGO_KAKAO_SENDER_KEY ? `present(len=${String(vars.INSURANCE_ALIGO_KAKAO_SENDER_KEY).length})` : 'missing',
    sender: vars.INSURANCE_ALIGO_KAKAO_SENDER ? 'present' : 'missing',
    outboundHint: vars.SMS_MODULE_OUTBOUND_IP_HINT ?? null,
  }
}

if (MODE === 'status') {
  console.log(JSON.stringify({ development: safeStatus(readVars('development')) }, null, 2))
  process.exit(0)
}

if (MODE === 'enable') {
  const prod = readVars('production')
  const dev = readVars('development')
  const copied = {}
  for (const key of COPY_FROM_PROD) {
    if (prod[key]) copied[key] = prod[key]
  }
  setDevVars({ ...copied, ...ENABLE_VARS })
  console.log(
    JSON.stringify(
      {
        mode: 'enable',
        testPhone: TEST_PHONE,
        copiedKeys: Object.keys(copied),
        development: safeStatus({ ...dev, ...copied, ...ENABLE_VARS }),
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

function deleteDevVars(keys) {
  for (const key of keys) {
    sh(`railway variable delete ${key} -e development -s app --json`)
  }
}

if (MODE === 'disable') {
  setDevVars(DISABLE_VARS)
  deleteDevVars(DISABLE_DELETE_KEYS)
  console.log(JSON.stringify({ mode: 'disable', development: safeStatus(readVars('development')) }, null, 2))
  process.exit(0)
}

console.error(`Unknown mode: ${MODE}`)
process.exit(1)
