/** 서버 `customers.crm_extension` / API `crmExtension` — canonical fieldKey → 문자열 */
export type CustomerCrmExtension = {
  v?: number
  fields: Record<string, string>
}

const EXT_KEY_LEN_MAX = 120
const EXT_VAL_LEN_MAX = 8000

/**
 * 업종 폼 상태 → API POST/PUT 바디용.
 * - 모든 엔트리를 유지(빈 문자열 포함): PUT 시 JSONB 교체 저장과 맞춤.
 * - 키·값 길이는 서버 `customerCrmExtension` 과 동일 상한 적용.
 */
export function buildCrmExtensionPayloadForSave(
  fields: Record<string, string> | undefined | null,
): CustomerCrmExtension | undefined {
  if (fields == null || typeof fields !== 'object') {
    return undefined
  }
  const out: Record<string, string> = {}
  for (const [k0, v0] of Object.entries(fields)) {
    const k = String(k0 ?? '').trim().slice(0, EXT_KEY_LEN_MAX)
    if (!k) continue
    out[k] = String(v0 ?? '').slice(0, EXT_VAL_LEN_MAX)
  }
  if (Object.keys(out).length === 0) {
    return undefined
  }
  return { v: 1, fields: out }
}

/** YYYY-MM-DD 만 통과, 그 외·공백은 undefined (필드 생략용) */
export function normalizeBirthDateForSaveApi(raw: string | undefined | null): string | undefined {
  const s = String(raw ?? '').trim().slice(0, 10)
  if (!s) {
    return undefined
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined
}

export function normalizeCustomerCrmExtension(raw: unknown): CustomerCrmExtension {
  if (raw == null) {
    return { fields: {} }
  }
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown
      return normalizeCustomerCrmExtension(o)
    } catch {
      return { fields: {} }
    }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { fields: {} }
  }
  const o = raw as Record<string, unknown>
  const src =
    o.fields && typeof o.fields === 'object' && !Array.isArray(o.fields)
      ? (o.fields as Record<string, unknown>)
      : o
  const fields: Record<string, string> = {}
  for (const [k0, v0] of Object.entries(src)) {
    if (typeof k0 !== 'string' || !k0.trim()) continue
    const k = k0.trim().slice(0, 120)
    if (!k) continue
    fields[k] = v0 == null ? '' : String(v0).slice(0, 8000)
  }
  return { v: typeof o.v === 'number' ? o.v : 1, fields }
}
