import { loadInsuranceAlimtalkConfig } from './alimtalkConfig.js'

/**
 * profile/list 진단 (실발송 없음). 관리자 UI 비노출 — CLI/테스트용.
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
    }
  }

  const params = new URLSearchParams()
  params.set('apikey', config.apiKey)
  params.set('userid', config.userId)

  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  try {
    const res = await fetchImpl(config.profileListUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const text = await res.text()
    let parsed = {}
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
        String(/** @type {Record<string, unknown>} */ (item).senderkey ?? '').trim() === config.senderKey,
    )
    return {
      ok: code === 0,
      code,
      message: parsed?.message != null ? String(parsed.message) : null,
      list,
      senderKeyMatch,
    }
  } catch (err) {
    return {
      ok: false,
      code: null,
      message: err instanceof Error ? err.message : 'network error',
      list: [],
      senderKeyMatch: false,
    }
  }
}
