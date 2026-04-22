/**
 * PDF 자동화 엔진 — 필드/배치(placement) 스키마 검증.
 *
 * 책임:
 *   - 외부(관리자 UI·API 요청 바디)에서 들어온 raw 데이터를 "도메인 객체" 로 정규화한다.
 *   - 허용되지 않는 타입/좌표/키 네이밍을 방어해 하위 모듈(repository, renderer)이
 *     불변 조건(타입 일관성) 을 당연하게 가정할 수 있게 한다.
 *
 * 의존성 원칙:
 *   - 이 모듈은 어떤 I/O 도 하지 않는다(pure). 테스트 대상.
 *   - DB/HTTP/pdf-lib 에 의존하지 않는다. 다른 레이어가 이 모듈에 맞춘다.
 *
 * 확장 포인트:
 *   - Phase 2 에서 radio/checkbox/select 를 추가하려면 ALLOWED_FIELD_TYPES 에 값 추가
 *     + placement 에 `optionValue` 파싱 라인 한 줄만 추가하면 된다.
 *   - DB CHECK 제약 도 같이 확장해야 한다(initDb.js 의 ensurePdfTemplateSchema).
 */

/** Phase 1 허용 타입. 추가 시 이 배열만 늘리면 모든 검증/스키마가 함께 확장된다. */
export const ALLOWED_FIELD_TYPES = Object.freeze([
  'text',
  'number',
  'date',
  'textarea',
])

/** 관리자 폼에서 받을 수 있는 고객 데이터 자동 매핑 키(Phase 2 에서 실제 주입). */
export const ALLOWED_CUSTOMER_MAPPINGS = Object.freeze([
  'name',
  'dob',
  'phone',
  'address',
])

/** 필드 key 네이밍 규칙: 라틴 소문자/숫자/언더스코어. 한글·공백 금지 — PDF 내부 검색/스크립트 안정성. */
const FIELD_KEY_REGEX = /^[a-z][a-z0-9_]{0,63}$/

/** 텍스트 정렬 — PDF 출력 시 좌·중·우. Phase 1 은 left 기본. */
const ALLOWED_ALIGNS = Object.freeze(['left', 'center', 'right'])

/** 최대 한 문서의 필드/배치 상한. 악성 입력 방지. */
const MAX_FIELDS_PER_TEMPLATE = 500
const MAX_PLACEMENTS_PER_FIELD = 50
const MAX_PAGE_INDEX = 999

/**
 * @typedef {{
 *   page: number,
 *   x: number,
 *   y: number,
 *   width: number | null,
 *   height: number | null,
 *   fontSize: number | null,
 *   align: 'left' | 'center' | 'right',
 * }} Placement
 */

/**
 * @typedef {{
 *   fieldKey: string,
 *   label: string,
 *   fieldType: typeof ALLOWED_FIELD_TYPES[number],
 *   required: boolean,
 *   orderIndex: number,
 *   customerMapping: typeof ALLOWED_CUSTOMER_MAPPINGS[number] | null,
 *   placements: Placement[],
 * }} FieldSpec
 */

function toFiniteNumberOrNull(value) {
  if (value == null) return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function clampNonNegativeNumber(value, fallback) {
  const n = toFiniteNumberOrNull(value)
  if (n == null || n < 0) return fallback
  return n
}

function normalizePlacement(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('placement 은 객체여야 합니다.')
  }
  const src = /** @type {Record<string, unknown>} */ (raw)
  const pageRaw = toFiniteNumberOrNull(src.page)
  const page = pageRaw == null ? 0 : Math.max(0, Math.floor(pageRaw))
  if (page > MAX_PAGE_INDEX) {
    throw new Error(`placement.page 범위 초과: ${page}`)
  }
  const x = toFiniteNumberOrNull(src.x)
  const y = toFiniteNumberOrNull(src.y)
  if (x == null || y == null || x < 0 || y < 0) {
    throw new Error('placement.x, placement.y 는 0 이상의 유한 수여야 합니다.')
  }

  const width = clampNonNegativeNumber(src.width, null)
  const height = clampNonNegativeNumber(src.height, null)
  const fontSize = clampNonNegativeNumber(src.fontSize, null)

  const alignRaw = typeof src.align === 'string' ? src.align.trim().toLowerCase() : ''
  const align = ALLOWED_ALIGNS.includes(alignRaw) ? /** @type {'left'|'center'|'right'} */ (alignRaw) : 'left'

  return {
    page,
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    width: width != null ? Math.round(width * 100) / 100 : null,
    height: height != null ? Math.round(height * 100) / 100 : null,
    fontSize: fontSize != null ? Math.round(fontSize) : null,
    align,
  }
}

/**
 * raw 필드 데이터를 FieldSpec 으로 정규화. 실패 시 throw.
 *
 * @param {unknown} raw
 * @param {number} fallbackOrder
 * @returns {FieldSpec}
 */
export function normalizeFieldSpec(raw, fallbackOrder = 0) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('필드는 객체여야 합니다.')
  }
  const src = /** @type {Record<string, unknown>} */ (raw)

  const fieldKey = typeof src.fieldKey === 'string' ? src.fieldKey.trim() : ''
  if (!FIELD_KEY_REGEX.test(fieldKey)) {
    throw new Error(
      `필드 key 형식이 올바르지 않습니다: "${fieldKey}". 소문자/숫자/언더스코어로 시작하며 64자 이하여야 합니다.`,
    )
  }

  const label = typeof src.label === 'string' ? src.label.trim() : ''
  if (!label) {
    throw new Error(`필드 label 이 비어 있습니다. (${fieldKey})`)
  }

  const fieldTypeRaw = typeof src.fieldType === 'string' ? src.fieldType.trim().toLowerCase() : ''
  if (!ALLOWED_FIELD_TYPES.includes(fieldTypeRaw)) {
    throw new Error(`허용되지 않는 필드 타입입니다: "${fieldTypeRaw}". (${fieldKey})`)
  }

  const required = Boolean(src.required)
  const orderIdxRaw = toFiniteNumberOrNull(src.orderIndex)
  const orderIndex = orderIdxRaw == null ? fallbackOrder : Math.max(0, Math.floor(orderIdxRaw))

  const mappingRaw = typeof src.customerMapping === 'string' ? src.customerMapping.trim() : ''
  const customerMapping =
    mappingRaw && ALLOWED_CUSTOMER_MAPPINGS.includes(mappingRaw)
      ? /** @type {FieldSpec['customerMapping']} */ (mappingRaw)
      : null

  const placementsRaw = Array.isArray(src.placements) ? src.placements : []
  if (placementsRaw.length > MAX_PLACEMENTS_PER_FIELD) {
    throw new Error(`필드 ${fieldKey} 의 placement 수가 상한(${MAX_PLACEMENTS_PER_FIELD})을 초과했습니다.`)
  }
  const placements = placementsRaw.map((p) => normalizePlacement(p))

  return {
    fieldKey,
    label,
    fieldType: /** @type {FieldSpec['fieldType']} */ (fieldTypeRaw),
    required,
    orderIndex,
    customerMapping,
    placements,
  }
}

/**
 * 필드 배열을 정규화한다. key 중복을 금지한다.
 *
 * @param {unknown} raw
 * @returns {FieldSpec[]}
 */
export function normalizeFieldSpecList(raw) {
  if (!Array.isArray(raw)) {
    throw new Error('fields 는 배열이어야 합니다.')
  }
  if (raw.length > MAX_FIELDS_PER_TEMPLATE) {
    throw new Error(`필드 수가 상한(${MAX_FIELDS_PER_TEMPLATE})을 초과했습니다.`)
  }
  const seen = new Set()
  const result = []
  for (let i = 0; i < raw.length; i += 1) {
    const field = normalizeFieldSpec(raw[i], i)
    if (seen.has(field.fieldKey)) {
      throw new Error(`필드 key 가 중복됩니다: "${field.fieldKey}"`)
    }
    seen.add(field.fieldKey)
    result.push(field)
  }
  return result
}

/**
 * 사용자 입력값 검증: 필드 정의 + values → 렌더링에 쓸 수 있는 문자열 map 으로 변환.
 *
 * @param {FieldSpec[]} fields
 * @param {Record<string, unknown>} values
 * @returns {{ ok: true, normalized: Record<string, string> } | { ok: false, error: string }}
 */
export function validateRenderValues(fields, values) {
  const normalized = {}
  for (const f of fields) {
    const raw = values?.[f.fieldKey]
    const str = raw == null ? '' : String(raw).trim()
    if (f.required && !str) {
      return { ok: false, error: `"${f.label}" 항목은 필수입니다.` }
    }
    if (f.fieldType === 'number' && str !== '' && Number.isNaN(Number(str))) {
      return { ok: false, error: `"${f.label}" 은(는) 숫자여야 합니다.` }
    }
    if (f.fieldType === 'date' && str !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return { ok: false, error: `"${f.label}" 은(는) YYYY-MM-DD 형식이어야 합니다.` }
    }
    normalized[f.fieldKey] = str
  }
  return { ok: true, normalized }
}
