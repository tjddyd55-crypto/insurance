/**
 * Alimtalk Railway→Aligo direct cutover preflight.
 * Aligo API 호출은 Railway app 프로세스에서만 outbound Static IP가 적용된다.
 *
 * Usage (after INSURANCE_ALIMTALK_PROVIDER=aligo deploy):
 *   Production container / one-off job에서 실행
 *   node server/scripts/alimtalkDirectCutoverSmoke.mjs
 *
 * Env (never print secrets):
 * - optional ALIMTALK_SMOKE_BASE_URL
 */
import { loadInsuranceAlimtalkConfig } from '../alimtalk/alimtalkConfig.js'
import { checkInsuranceAlimtalkProfileList } from '../alimtalk/alimtalkProfileDiagnostics.js'

const BASE = String(process.env.ALIMTALK_SMOKE_BASE_URL ?? 'https://insurance-production-7bd8.up.railway.app').replace(
  /\/$/,
  '',
)

async function main() {
  const config = loadInsuranceAlimtalkConfig()
  const gatewayUrl = String(process.env.INSURANCE_ALIGO_KAKAO_GATEWAY_URL ?? '').trim()
  const kakaoGatewayUrlPresent = Boolean(gatewayUrl)
  const smsAuth = String(process.env.AUTH_SMS_PROVIDER ?? '').trim()
  const smsModule = String(process.env.SMS_MODULE_PROVIDER ?? '').trim()

  console.log(
    JSON.stringify({
      phase: 'preflight',
      alimtalkProvider: config.provider,
      alimtalkProviderEnv: config.alimtalkProviderEnv,
      useGateway: config.useGateway,
      kakaoGatewayUrlPresent,
      smsAuthProvider: smsAuth || '(unset)',
      smsModuleProvider: smsModule || '(unset)',
      baseUrl: BASE,
    }),
  )

  if (config.useGateway) {
    console.error(
      JSON.stringify({
        phase: 'abort',
        reason: 'still_on_gateway',
        hint: 'Set INSURANCE_ALIMTALK_PROVIDER=aligo and redeploy',
      }),
    )
    process.exit(2)
  }

  if (smsAuth && smsAuth.toLowerCase() !== 'aligo') {
    console.error(JSON.stringify({ phase: 'abort', reason: 'auth_sms_not_aligo', smsAuth }))
    process.exit(2)
  }
  if (smsModule && smsModule.toLowerCase() !== 'aligo') {
    console.error(JSON.stringify({ phase: 'abort', reason: 'crm_sms_not_aligo', smsModule }))
    process.exit(2)
  }

  if (!kakaoGatewayUrlPresent) {
    console.warn(
      JSON.stringify({
        phase: 'warn',
        reason: 'rollback_gateway_url_missing',
        hint: 'Keep INSURANCE_ALIGO_KAKAO_GATEWAY_URL for rollback',
      }),
    )
  }

  const profile = await checkInsuranceAlimtalkProfileList({ config })
  console.log(
    JSON.stringify({
      phase: 'profile_list',
      via: profile.via,
      ok: profile.ok,
      code: profile.code,
      message: profile.message,
      listCount: Array.isArray(profile.list) ? profile.list.length : 0,
      senderKeyMatch: profile.senderKeyMatch,
    }),
  )

  if (!profile.ok || profile.code !== 0) {
    console.error(JSON.stringify({ phase: 'abort', reason: 'profile_list_failed' }))
    process.exit(3)
  }

  console.log(JSON.stringify({ phase: 'done', marker: 'ALIMTALK_RAILWAY_DIRECT_READY' }))
}

main().catch((err) => {
  console.error(JSON.stringify({ phase: 'fatal', message: String(err?.message ?? err) }))
  process.exit(1)
})
