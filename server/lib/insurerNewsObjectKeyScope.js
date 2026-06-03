import { INSURER_R2_ACTIVE_CATEGORY, INSURER_R2_CATEGORY } from './insurerR2Layout.js'
import { stripR2ObjectRootIfPresent } from './r2KeyPolicy.js'
import {
  INSURANCE_STORAGE_CATEGORY,
  assertInsuranceSharedStorageKey,
  normalizeInsuranceGaCode,
} from './insuranceStorageLayout.js'

const LOSS_ADJUSTER_R2_CATEGORY = INSURER_R2_CATEGORY.LOSS_ADJUSTER
const LEGACY_LOSS_ADJUSTER_R2_CATEGORY = 'LossAdjuster'

/**
 * presign·저장 검증에서 동일한 GA 코드를 쓰기 위한 해석 (gaIdPath 숫자 id ≠ ga code).
 * @param {string} [gaCodeRaw]
 * @param {string} [gaIdPath]
 */
export function resolveInsurerNewsGaCodeForStorage(gaCodeRaw, gaIdPath) {
  return (
    normalizeInsuranceGaCode(gaCodeRaw) ||
    normalizeInsuranceGaCode(gaIdPath) ||
    String(gaIdPath ?? '').trim()
  )
}

/**
 * @typedef {object} AssertNewsObjectKeyScope
 * @property {string} gaIdPath — legacy `insurer/{gaIdPath}/…` 경로용 숫자 GA id
 * @property {string} [gaCodeRaw] — SSOT `insurance/{gaCode}/…` 경로용 (예: yjasset)
 * @property {string} storageCategory
 * @property {string} companySlug
 * @property {boolean} [allowLegacyLossAdjusterCategory]
 */

/**
 * 원수사·손해사정사 소식지 첨부 object key 범위 검증 (SSOT + legacy).
 * @param {string} objectKey
 * @param {AssertNewsObjectKeyScope} scope
 */
export function assertNewsObjectKeyScoped(objectKey, scope) {
  const gaIdPath = String(scope.gaIdPath ?? '').trim()
  const gaCodeRaw = String(scope.gaCodeRaw ?? '').trim()
  const storageCategory = String(scope.storageCategory ?? '').trim()
  const companySlug = String(scope.companySlug ?? '').trim()
  const allowLegacyLossAdjusterCategory = Boolean(scope.allowLegacyLossAdjusterCategory)

  const k = stripR2ObjectRootIfPresent(String(objectKey ?? '').trim().replace(/^\//, ''))
  const gaCode = resolveInsurerNewsGaCodeForStorage(gaCodeRaw, gaIdPath)
  const isLossAdjusterCategory = storageCategory === LOSS_ADJUSTER_R2_CATEGORY
  const sharedCategory = isLossAdjusterCategory
    ? INSURANCE_STORAGE_CATEGORY.ADJUSTER_NEWSLETTERS
    : INSURANCE_STORAGE_CATEGORY.INSURER_NEWSLETTERS

  if (
    gaCode &&
    assertInsuranceSharedStorageKey(k, gaCode, sharedCategory, {
      insurerCode: companySlug,
      adjusterCode: companySlug,
      companySlug,
    })
  ) {
    return true
  }

  const parts = k.split('/')

  if (parts[0] === 'insurer-news' && parts.length === 6) {
    const catSeg = parts[1]
    const yyyy = parts[2]
    const mm = parts[3]
    const slugSeg = parts[4]
    const fileSeg = parts[5]
    const isLegacyLossAdjusterCategory =
      catSeg === LEGACY_LOSS_ADJUSTER_R2_CATEGORY || catSeg === INSURER_R2_ACTIVE_CATEGORY
    const categoryMatches =
      catSeg === storageCategory ||
      (allowLegacyLossAdjusterCategory &&
        isLossAdjusterCategory &&
        isLegacyLossAdjusterCategory)
    if (!categoryMatches) {
      return false
    }
    if (!/^\d{4}$/.test(yyyy) || !/^\d{2}$/.test(mm)) {
      return false
    }
    if (slugSeg !== companySlug) {
      return false
    }
    if (!fileSeg || !String(fileSeg).trim()) {
      return false
    }
    return true
  }

  if (parts.length < 6) {
    return false
  }
  const isLegacyLossAdjusterCategory =
    parts[2] === LEGACY_LOSS_ADJUSTER_R2_CATEGORY || parts[2] === INSURER_R2_ACTIVE_CATEGORY
  const categoryMatches =
    parts[2] === storageCategory ||
    (allowLegacyLossAdjusterCategory &&
      isLossAdjusterCategory &&
      isLegacyLossAdjusterCategory)
  if (parts[0] !== 'insurer' || parts[1] !== gaIdPath || !categoryMatches) {
    return false
  }
  let companyIndex = 4
  if (/^\d{4}$/.test(parts[3]) && /^\d{2}$/.test(parts[4])) {
    companyIndex = 5
  } else if (/^\d{4}-\d{2}$/.test(parts[3])) {
    companyIndex = 4
  } else {
    return false
  }
  if (parts[companyIndex] !== companySlug) {
    return false
  }
  if (parts.length !== companyIndex + 2) {
    return false
  }
  if (!parts[companyIndex + 1] || !String(parts[companyIndex + 1]).trim()) {
    return false
  }
  return true
}
