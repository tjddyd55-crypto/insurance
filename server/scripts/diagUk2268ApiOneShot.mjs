/**
 * Controlled one-shot UK_2268 API send (not customer event / not outbox).
 * Usage:
 *   railway run --service app --environment production -- \
 *     node server/scripts/diagUk2268ApiOneShot.mjs
 *
 * Sends 1 message to the fixed internal test receiver with absolute https button URL.
 * Does NOT touch reg-complete-alimtalk idempotency / outbox.
 */
import { loadInsuranceAlimtalkConfig } from '../alimtalk/alimtalkConfig.js'
import { sendAligoAlimtalk, isAligoAlimtalkSuccessCode } from '../alimtalk/alimtalkProvider.js'
import {
  CUSTOMER_REGISTRATION_COMPLETED_SUBJECT,
  CUSTOMER_REGISTRATION_COMPLETED_EXPECTED_TPL_CODE,
  buildCustomerRegistrationCompletedButtonPayload,
  buildCustomerRegistrationCompletedMessage,
} from '../alimtalk/alimtalkTemplates.js'

const RECEIVER = '01022221382'
const CUSTOMER_NAME = '알림톡테스트'
const REGISTERED_AT = '2026-08-25 18:30'
const CHECK_URL =
  'https://insurance-production-7bd8.up.railway.app/customers/2108/consultations?customerId=2108'

const config = loadInsuranceAlimtalkConfig()
const buttonPayload = buildCustomerRegistrationCompletedButtonPayload({
  customerCheckUrl: CHECK_URL,
})
const message = buildCustomerRegistrationCompletedMessage({
  customerName: CUSTOMER_NAME,
  registeredAtLabel: REGISTERED_AT,
})

console.log(
  JSON.stringify(
    {
      phase: 'request_preview',
      tplCode: CUSTOMER_REGISTRATION_COMPLETED_EXPECTED_TPL_CODE,
      receiverMasked: '010****1382',
      subject: CUSTOMER_REGISTRATION_COMPLETED_SUBJECT,
      registeredAt: REGISTERED_AT,
      buttonName: buttonPayload.button[0]?.name ?? null,
      linkMoHasScheme: /^https?:\/\//i.test(String(buttonPayload.button[0]?.linkMo ?? '')),
      linkMoIsHttp: /^http:\/\//i.test(String(buttonPayload.button[0]?.linkMo ?? '')),
      linkMoIsHttps: /^https:\/\//i.test(String(buttonPayload.button[0]?.linkMo ?? '')),
      linkMoHostPath: String(buttonPayload.button[0]?.linkMo ?? '')
        .replace(/^https?:\/\//i, '')
        .slice(0, 80),
      messageHasUnreplacedVar: /#\{/.test(message),
      dryRunConfig: config.dryRun,
      allowRealSend: config.allowRealSend,
    },
    null,
    2,
  ),
)

const result = await sendAligoAlimtalk({
  config,
  dryRun: false,
  tplCode: CUSTOMER_REGISTRATION_COMPLETED_EXPECTED_TPL_CODE,
  templateKey: 'INSURANCE_CUSTOMER_REGISTRATION_COMPLETED_ONESHOT',
  receiver: RECEIVER,
  subject: CUSTOMER_REGISTRATION_COMPLETED_SUBJECT,
  message,
  buttonPayload,
  recvName: CUSTOMER_NAME,
})

const mid = result.providerMessageId != null ? String(result.providerMessageId) : null
console.log(
  JSON.stringify(
    {
      phase: 'accept',
      status: result.status,
      providerCode: result.providerCode,
      providerMessage: result.providerMessage,
      midPresent: Boolean(mid),
      midPrefix: mid ? `${mid.slice(0, 8)}…` : null,
      accepted: isAligoAlimtalkSuccessCode(result.providerCode) && result.status === 'accepted',
    },
    null,
    2,
  ),
)

if (!mid || !config.gatewayUrl || !config.gatewayToken) {
  console.log(JSON.stringify({ phase: 'history', skipped: true }))
  process.exit(isAligoAlimtalkSuccessCode(result.providerCode) ? 0 : 1)
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms))
}

let final = null
for (let attempt = 1; attempt <= 8; attempt += 1) {
  await sleep(attempt === 1 ? 3000 : 5000)
  const url = `${config.gatewayUrl.replace(/\/+$/, '')}/history-detail`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.gatewayToken}`,
    },
    body: JSON.stringify({
      mid,
      apikey: config.apiKey,
      userid: config.userId,
      apiKey: config.apiKey,
      userId: config.userId,
    }),
  })
  const parsed = await res.json().catch(() => ({}))
  const list = Array.isArray(parsed.list) ? parsed.list : []
  const row = list[0] || null
  const rslt = row?.rslt ?? row?.result ?? null
  const rsltMsg = row?.rslt_message ?? row?.rslt_msg ?? row?.message ?? null
  final = {
    attempt,
    historyHttp: res.status,
    providerCode: parsed.providerCode ?? parsed.code ?? null,
    rslt,
    rslt_msg: rsltMsg,
  }
  console.log(JSON.stringify({ phase: 'history_poll', ...final }, null, 2))
  // Aligo history-detail: success often rslt="0"/"S"; failure "F"/"U"/...
  if (rslt === '0' || rslt === 'S' || rslt === 'F' || rslt === 'U' || rslt === 'W') break
}

const pass = final?.rslt === '0' || final?.rslt === 'S'
console.log(
  JSON.stringify(
    {
      phase: 'summary',
      acceptOk: isAligoAlimtalkSuccessCode(result.providerCode),
      finalRslt: final?.rslt ?? null,
      finalReason: final?.rslt_msg ?? null,
      pass,
    },
    null,
    2,
  ),
)
process.exit(pass ? 0 : 2)
