import { loadInsuranceAlimtalkConfig } from './alimtalkConfig.js'

/**
 * profile/list 진단 (실발송 없음). 관리자 UI 비노출 — CLI/테스트용.
 * gateway URL 이 있으면 EC2 relay 로 조회한다 (Railway IP 화이트리스트 회피).
 * @param {{
 *   config?: ReturnType<typeof loadInsuranceAlimtalkConfig>,
 *   fetchImpl?: typeof fetch,
 * }} [opts]
 */
export async function checkInsuranceAlimtalkProfileList(opts = {}) {
  const config = opts.config ?? loadInsuranceAlimtalkConfig()
  if (!config.apiKey || !config.userId) {
    return {
      ok: false,
      code: null,
      message: 'INSURANCE_ALIGO_KAKAO_API_KEY / USER_ID missing',
      list: [],
      senderKeyMatch: false,
      via: config.useGateway ? 'gateway' : 'direct',
    }
  }

  const fetchImpl = opts.fetchImpl ?? globalThis.fetch

  try {
    let parsed = {}
    let httpStatus = null

    if (config.useGateway) {
      if (!config.gatewayToken) {
        return {
          ok: false,
          code: null,
          message: 'Alimtalk gateway token is not configured',
          list: [],
          senderKeyMatch: false,
          via: 'gateway',
        }
      }
      const url = `${config.gatewayUrl.replace(/\/+$/, '')}/profile-list`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), config.sendTimeoutMs)
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.gatewayToken}`,
        },
        body: JSON.stringify({ apikey: config.apiKey, userid: config.userId }),
        signal: controller.signal,
      })
      clearTimeout(timer)
      httpStatus = res.status
      const text = await res.text()
      try {
        parsed = text ? JSON.parse(text) : {}
      } catch {
        parsed = { message: String(text).slice(0, 300) }
      }
      const code =
        parsed?.providerCode != null
          ? Number(parsed.providerCode)
          : parsed?.code != null
            ? Number(parsed.code)
            : null
      const list = Array.isArray(parsed?.list) ? parsed.list : []
      const senderKeyMatch = list.some(
        (item) =>
          item &&
          typeof item === 'object' &&
          String(/** @type {Record<string, unknown>} */ (item).senderkey ?? '').trim() ===
            config.senderKey,
      )
      return {
        ok: code === 0,
        code,
        message:
          parsed?.providerMessage != null
            ? String(parsed.providerMessage)
            : parsed?.message != null
              ? String(parsed.message)
              : null,
        list,
        senderKeyMatch,
        via: 'gateway',
        httpStatus,
      }
    }

    const params = new URLSearchParams()
    params.set('apikey', config.apiKey)
    params.set('userid', config.userId)
    const res = await fetchImpl(config.profileListUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    httpStatus = res.status
    const text = await res.text()
    try {
      parsed = text ? JSON.parse(text) : {}
    } catch {
      parsed = { message: String(text).slice(0, 300) }
    }
    const code = parsed?.code != null ? Number(parsed.code) : null
    const list = Array.isArray(parsed?.list) ? parsed.list : []
    const senderKeyMatch = list.some(
      (item) =>
        item &&
        typeof item === 'object' &&
        String(/** @type {Record<string, unknown>} */ (item).senderkey ?? '').trim() ===
          config.senderKey,
    )
    return {
      ok: code === 0,
      code,
      message: parsed?.message != null ? String(parsed.message) : null,
      list,
      senderKeyMatch,
      via: 'direct',
      httpStatus,
    }
  } catch (err) {
    return {
      ok: false,
      code: null,
      message: err instanceof Error ? err.message : 'network error',
      list: [],
      senderKeyMatch: false,
      via: config.useGateway ? 'gateway' : 'direct',
    }
  }
}
