/**
 * R2 object key SSOT — bucket `platform-assets`, top prefix `insurance/{gaCode}/…`.
 * 모든 신규 업로드 키는 이 모듈의 builder만 사용한다.
 */
import { joinR2Key, stripR2ObjectRootIfPresent, withR2ObjectRoot } from './r2KeyPolicy.js'

/** @typedef {typeof INSURANCE_STORAGE_CATEGORY[keyof typeof INSURANCE_STORAGE_CATEGORY]} InsuranceStorageCategory */

export const INSURANCE_STORAGE_BUCKET = 'platform-assets'

export const INSURANCE_STORAGE_ROOT_PREFIX = 'insurance'

export const INSURANCE_STORAGE_CATEGORY = Object.freeze({
  CUSTOMER_FILES: 'customer-files',
  PERSONAL_FILES: 'personal-files',
  CUSTOMER_CLAIM_APP_FILES: 'customer-claim-app-files',
  CUSTOMER_MESSAGES: 'customer-messages',
  CUSTOMER_NEWSLETTERS: 'customer-newsletters',
  SHARED_CUSTOMER_NEWSLETTERS: 'shared-customer-newsletters',
  INSURER_NEWSLETTERS: 'insurer-newsletters',
  ADJUSTER_NEWSLETTERS: 'adjuster-newsletters',
  GA_NOTICES: 'ga-notices',
  TEAM_FILES: 'team-files',
  CONTRACT_DOCUMENTS: 'contract-documents',
  SIGNATURE_DOCUMENTS: 'signature-documents',
  TEMP_UPLOADS: 'temp-uploads',
})

const USER_CATEGORIES = new Set([
  INSURANCE_STORAGE_CATEGORY.CUSTOMER_FILES,
  INSURANCE_STORAGE_CATEGORY.PERSONAL_FILES,
  INSURANCE_STORAGE_CATEGORY.CUSTOMER_CLAIM_APP_FILES,
  INSURANCE_STORAGE_CATEGORY.CUSTOMER_MESSAGES,
  INSURANCE_STORAGE_CATEGORY.CUSTOMER_NEWSLETTERS,
  INSURANCE_STORAGE_CATEGORY.CONTRACT_DOCUMENTS,
  INSURANCE_STORAGE_CATEGORY.SIGNATURE_DOCUMENTS,
  INSURANCE_STORAGE_CATEGORY.TEMP_UPLOADS,
])

const SHARED_CATEGORIES = new Set([
  INSURANCE_STORAGE_CATEGORY.SHARED_CUSTOMER_NEWSLETTERS,
  INSURANCE_STORAGE_CATEGORY.INSURER_NEWSLETTERS,
  INSURANCE_STORAGE_CATEGORY.ADJUSTER_NEWSLETTERS,
  INSURANCE_STORAGE_CATEGORY.GA_NOTICES,
])

/** category 상수 → R2 path 세그먼트 (shared/ 아래) */
const SHARED_CATEGORY_PATH_SEGMENT = Object.freeze({
  [INSURANCE_STORAGE_CATEGORY.SHARED_CUSTOMER_NEWSLETTERS]: 'customer-newsletters',
  [INSURANCE_STORAGE_CATEGORY.INSURER_NEWSLETTERS]: INSURANCE_STORAGE_CATEGORY.INSURER_NEWSLETTERS,
  [INSURANCE_STORAGE_CATEGORY.ADJUSTER_NEWSLETTERS]: INSURANCE_STORAGE_CATEGORY.ADJUSTER_NEWSLETTERS,
  [INSURANCE_STORAGE_CATEGORY.GA_NOTICES]: INSURANCE_STORAGE_CATEGORY.GA_NOTICES,
})

/**
 * @param {InsuranceStorageCategory} category
 */
function sharedCategoryPathSegment(category) {
  return SHARED_CATEGORY_PATH_SEGMENT[category] ?? category
}

/**
 * @param {unknown} value
 */
export function normalizeInsuranceGaCode(value) {
  const s = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
  return s || ''
}

/**
 * @param {unknown} value
 */
export function sanitizeInsuranceUserIdSegment(value) {
  const s = String(value ?? '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 128)
  return s || '_'
}

/**
 * @param {unknown} value
 */
export function sanitizeInsurancePathSegment(value, maxLen = 64) {
  const s = String(value ?? '')
    .trim()
    .replace(/[^\w.\-()\u3131-\u318e\uac00-\ud7a3]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLen)
  return s || '_'
}

/**
 * @param {unknown} value
 */
export function sanitizeInsuranceFileName(value, maxLen = 120) {
  const s = String(value ?? '')
    .trim()
    .replace(/[^\w.\-()\u3131-\u318e\uac00-\ud7a3]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLen)
  return s || 'file'
}

/**
 * @param {Date} [now]
 */
export function insuranceStorageYearMonth(now = new Date()) {
  const d = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date()
  const yyyy = String(d.getUTCFullYear())
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return { yyyy, mm, timestamp: d.getTime() }
}

/**
 * @param {unknown} originalName
 * @param {Date} [now]
 */
export function buildInsuranceTimestampedFileSegment(originalName, now = new Date()) {
  const { timestamp } = insuranceStorageYearMonth(now)
  const safeName = sanitizeInsuranceFileName(originalName)
  return `${timestamp}-${safeName}`
}

/**
 * @param {object} params
 * @param {string} params.gaCode
 * @param {string} params.userId
 * @param {InsuranceStorageCategory} params.category
 * @param {number | string | null | undefined} [params.customerId]
 * @param {number | string | null | undefined} [params.claimId]
 * @param {number | string | null | undefined} [params.messageId]
 * @param {number | string | null | undefined} [params.newsletterId]
 * @param {number | string | null | undefined} [params.contractId]
 * @param {number | string | null | undefined} [params.sendSessionId]
 * @param {string} params.originalName
 * @param {Date} [params.now]
 */
export function buildInsuranceUserStorageKey(params) {
  const gaCode = normalizeInsuranceGaCode(params.gaCode)
  const userId = sanitizeInsuranceUserIdSegment(params.userId)
  const category = String(params.category ?? '').trim()
  if (!gaCode || !userId || !USER_CATEGORIES.has(category)) {
    throw new Error('invalid user storage key parameters')
  }

  const { yyyy, mm } = insuranceStorageYearMonth(params.now)
  const fileSeg = buildInsuranceTimestampedFileSegment(params.originalName, params.now)
  /** @type {string[]} */
  const parts = [INSURANCE_STORAGE_ROOT_PREFIX, gaCode, 'users', userId, category]

  if (category === INSURANCE_STORAGE_CATEGORY.CUSTOMER_FILES) {
    const customerId = sanitizeInsurancePathSegment(params.customerId)
    if (!customerId || customerId === '_') {
      throw new Error('customerId is required for customer-files')
    }
    parts.push(customerId, yyyy, mm, fileSeg)
  } else if (category === INSURANCE_STORAGE_CATEGORY.PERSONAL_FILES) {
    parts.push(yyyy, mm, fileSeg)
  } else if (category === INSURANCE_STORAGE_CATEGORY.CUSTOMER_CLAIM_APP_FILES) {
    const customerId = sanitizeInsurancePathSegment(params.customerId)
    const claimId = sanitizeInsurancePathSegment(params.claimId ?? 'pending')
    if (!customerId || customerId === '_') {
      throw new Error('customerId is required for customer-claim-app-files')
    }
    parts.push(customerId, claimId, yyyy, mm, fileSeg)
  } else if (category === INSURANCE_STORAGE_CATEGORY.CUSTOMER_MESSAGES) {
    const customerId = sanitizeInsurancePathSegment(params.customerId)
    const messageId = sanitizeInsurancePathSegment(params.messageId)
    if (!customerId || customerId === '_' || !messageId || messageId === '_') {
      throw new Error('customerId and messageId are required for customer-messages')
    }
    parts.push(customerId, messageId, yyyy, mm, fileSeg)
  } else if (category === INSURANCE_STORAGE_CATEGORY.CUSTOMER_NEWSLETTERS) {
    const customerId = sanitizeInsurancePathSegment(params.customerId ?? 'draft')
    const newsletterId = sanitizeInsurancePathSegment(params.newsletterId ?? 'draft')
    parts.push(customerId, newsletterId, yyyy, mm, fileSeg)
  } else if (category === INSURANCE_STORAGE_CATEGORY.CONTRACT_DOCUMENTS) {
    const customerId = sanitizeInsurancePathSegment(params.customerId)
    const contractId = sanitizeInsurancePathSegment(params.contractId)
    if (!customerId || customerId === '_' || !contractId || contractId === '_') {
      throw new Error('customerId and contractId are required for contract-documents')
    }
    parts.push(customerId, contractId, yyyy, mm, fileSeg)
  } else if (category === INSURANCE_STORAGE_CATEGORY.SIGNATURE_DOCUMENTS) {
    const customerId = sanitizeInsurancePathSegment(params.customerId)
    const sendSessionId = sanitizeInsurancePathSegment(params.sendSessionId)
    if (!customerId || customerId === '_' || !sendSessionId || sendSessionId === '_') {
      throw new Error('customerId and sendSessionId are required for signature-documents')
    }
    parts.push(customerId, sendSessionId, yyyy, mm, fileSeg)
  } else if (category === INSURANCE_STORAGE_CATEGORY.TEMP_UPLOADS) {
    parts.push(yyyy, mm, fileSeg)
  } else {
    throw new Error(`unsupported user storage category: ${category}`)
  }

  return withR2ObjectRoot(joinR2Key(...parts))
}

/**
 * @param {object} params
 * @param {string} params.gaCode
 * @param {InsuranceStorageCategory} params.category
 * @param {string} [params.insurerCode]
 * @param {string} [params.adjusterCode]
 * @param {number | string | null | undefined} [params.newsletterId]
 * @param {string} params.originalName
 * @param {Date} [params.now]
 */
export function buildInsuranceSharedStorageKey(params) {
  const gaCode = normalizeInsuranceGaCode(params.gaCode)
  const category = String(params.category ?? '').trim()
  if (!gaCode || !SHARED_CATEGORIES.has(category)) {
    throw new Error('invalid shared storage key parameters')
  }

  const { yyyy, mm } = insuranceStorageYearMonth(params.now)
  const fileSeg = buildInsuranceTimestampedFileSegment(params.originalName, params.now)
  const pathCategory = sharedCategoryPathSegment(category)
  /** @type {string[]} */
  const parts = [INSURANCE_STORAGE_ROOT_PREFIX, gaCode, 'shared', pathCategory]

  if (category === INSURANCE_STORAGE_CATEGORY.INSURER_NEWSLETTERS) {
    const insurerCode = sanitizeInsurancePathSegment(params.insurerCode)
    if (!insurerCode || insurerCode === '_') {
      throw new Error('insurerCode is required for insurer-newsletters')
    }
    parts.push(insurerCode, yyyy, mm, fileSeg)
  } else if (category === INSURANCE_STORAGE_CATEGORY.ADJUSTER_NEWSLETTERS) {
    const adjusterCode = sanitizeInsurancePathSegment(params.adjusterCode)
    if (!adjusterCode || adjusterCode === '_') {
      throw new Error('adjusterCode is required for adjuster-newsletters')
    }
    parts.push(adjusterCode, yyyy, mm, fileSeg)
  } else if (category === INSURANCE_STORAGE_CATEGORY.SHARED_CUSTOMER_NEWSLETTERS) {
    const newsletterId = sanitizeInsurancePathSegment(params.newsletterId ?? 'draft')
    parts.push(newsletterId, yyyy, mm, fileSeg)
  } else if (category === INSURANCE_STORAGE_CATEGORY.GA_NOTICES) {
    parts.push(yyyy, mm, fileSeg)
  } else {
    throw new Error(`unsupported shared storage category: ${category}`)
  }

  return withR2ObjectRoot(joinR2Key(...parts))
}

/**
 * @param {object} params
 * @param {string} params.gaCode
 * @param {string | number} params.teamId
 * @param {typeof INSURANCE_STORAGE_CATEGORY.TEAM_FILES} [params.category]
 * @param {string} params.originalName
 * @param {Date} [params.now]
 */
export function buildInsuranceTeamStorageKey(params) {
  const gaCode = normalizeInsuranceGaCode(params.gaCode)
  const teamId = sanitizeInsurancePathSegment(params.teamId)
  const category = String(params.category ?? INSURANCE_STORAGE_CATEGORY.TEAM_FILES).trim()
  if (!gaCode || !teamId || teamId === '_' || category !== INSURANCE_STORAGE_CATEGORY.TEAM_FILES) {
    throw new Error('invalid team storage key parameters')
  }

  const { yyyy, mm } = insuranceStorageYearMonth(params.now)
  const fileSeg = buildInsuranceTimestampedFileSegment(params.originalName, params.now)
  const parts = [
    INSURANCE_STORAGE_ROOT_PREFIX,
    gaCode,
    'teams',
    teamId,
    category,
    yyyy,
    mm,
    fileSeg,
  ]
  return withR2ObjectRoot(joinR2Key(...parts))
}

/**
 * @param {string} objectKey
 */
export function stripInsuranceStorageKey(objectKey) {
  return stripR2ObjectRootIfPresent(String(objectKey ?? '').trim().replace(/^\//, ''))
}

/**
 * @param {string} key
 */
function isInsuranceSsotKey(key) {
  const k = stripInsuranceStorageKey(key)
  return k.startsWith(`${INSURANCE_STORAGE_ROOT_PREFIX}/`)
}

/**
 * @param {string} objectKey
 * @param {string} gaCode
 * @param {string} userId
 * @param {InsuranceStorageCategory} category
 * @param {object} [scope]
 */
export function assertInsuranceUserStorageKey(objectKey, gaCode, userId, category, scope = {}) {
  const k = stripInsuranceStorageKey(objectKey)
  const ga = normalizeInsuranceGaCode(gaCode)
  const userSeg = sanitizeInsuranceUserIdSegment(userId)
  if (!k || !ga || !userSeg || k.includes('..')) {
    return false
  }

  if (isInsuranceSsotKey(k)) {
    const prefix = `${INSURANCE_STORAGE_ROOT_PREFIX}/${ga}/users/${userSeg}/${category}/`
    if (!k.startsWith(prefix)) {
      return false
    }
    const rest = k.slice(prefix.length)
    if (category === INSURANCE_STORAGE_CATEGORY.PERSONAL_FILES) {
      return /^\d{4}\/\d{2}\/\d+-.+/.test(rest)
    }
    if (category === INSURANCE_STORAGE_CATEGORY.CUSTOMER_FILES) {
      const customerId = scope.customerId != null ? sanitizeInsurancePathSegment(scope.customerId) : ''
      if (customerId && customerId !== '_') {
        return (
          rest.startsWith(`${customerId}/`) &&
          new RegExp(
            `^${customerId.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}/\\d{4}/\\d{2}/\\d+-.+`,
          ).test(rest)
        )
      }
      return /^[^/]+\/\d{4}\/\d{2}\/\d+-.+/.test(rest)
    }
    if (category === INSURANCE_STORAGE_CATEGORY.CUSTOMER_CLAIM_APP_FILES) {
      const customerId = sanitizeInsurancePathSegment(scope.customerId)
      return (
        rest.startsWith(`${customerId}/`) &&
        new RegExp(`^${customerId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[^/]+/\\d{4}/\\d{2}/\\d+-.+`).test(rest)
      )
    }
    if (category === INSURANCE_STORAGE_CATEGORY.TEMP_UPLOADS) {
      return /^\d{4}\/\d{2}\/\d+-.+/.test(rest)
    }
    if (category === INSURANCE_STORAGE_CATEGORY.CUSTOMER_NEWSLETTERS) {
      return /^(draft|[^/]+)\/([^/]+)\/\d{4}\/\d{2}\/\d+-.+/.test(rest)
    }
    if (category === INSURANCE_STORAGE_CATEGORY.CUSTOMER_MESSAGES) {
      return /^(draft|[^/]+)\/(draft|[^/]+)\/\d{4}\/\d{2}\/\d+-.+/.test(rest)
    }
    return rest.length > 0
  }

  return false
}

/**
 * 레거시 + SSOT 사용자 스토리지 키 (고객 파일·개인 파일·청구앱 등).
 * @param {string} objectKey
 * @param {string[]} gaPathCandidates ga code or legacy ga id path
 * @param {string} userId
 * @param {object} [scope]
 */
export function assertInsuranceUserOrLegacyStorageKey(objectKey, gaPathCandidates, userId, scope = {}) {
  const k = stripInsuranceStorageKey(objectKey)
  if (!k || k.includes('..')) {
    return false
  }
  const userSeg = sanitizeInsuranceUserIdSegment(userId)
  const gaCodes = (Array.isArray(gaPathCandidates) ? gaPathCandidates : [])
    .map((v) => normalizeInsuranceGaCode(v) || String(v ?? '').trim())
    .filter(Boolean)

  for (const ga of gaCodes) {
    if (
      assertInsuranceUserStorageKey(k, ga, userId, INSURANCE_STORAGE_CATEGORY.CUSTOMER_FILES, {
        customerId: scope.customerId ?? null,
      })
    ) {
      return true
    }
    if (assertInsuranceUserStorageKey(k, ga, userId, INSURANCE_STORAGE_CATEGORY.PERSONAL_FILES)) {
      return true
    }
  }

  if (scope.customerId != null) {
    for (const ga of gaCodes) {
      if (
        assertInsuranceUserStorageKey(k, ga, userId, INSURANCE_STORAGE_CATEGORY.CUSTOMER_CLAIM_APP_FILES, {
          customerId: scope.customerId,
        })
      ) {
        return true
      }
    }
  }

  for (const ga of gaCodes) {
    if (assertInsuranceUserStorageKey(k, ga, userId, INSURANCE_STORAGE_CATEGORY.TEMP_UPLOADS)) {
      return true
    }
    if (assertInsuranceUserStorageKey(k, ga, userId, INSURANCE_STORAGE_CATEGORY.CUSTOMER_NEWSLETTERS)) {
      return true
    }
  }

  const crmFilesPrefix = `files/${userSeg}/`
  if (k.startsWith(crmFilesPrefix)) {
    const fileSeg = k.slice(crmFilesPrefix.length)
    if (!fileSeg.includes('/') && /^\d+-.+/.test(fileSeg)) {
      return true
    }
  }

  for (const gaPath of gaPathCandidates) {
    const ga = String(gaPath ?? '').trim()
    if (!ga) {
      continue
    }
    const newPrefix = `insurer/${ga}/${userSeg}/`
    if (k.startsWith(newPrefix)) {
      const fileSeg = k.slice(newPrefix.length)
      if (!fileSeg.includes('/') && /^\d+-.+/.test(fileSeg)) {
        return true
      }
      if (fileSeg.startsWith('customer-app-claims/')) {
        return true
      }
      if (fileSeg.startsWith('customer-news-attachments/')) {
        return true
      }
    }
    const legacyPrefix = `platform-assets/insurer/${ga}/${userSeg}/files/storage/`
    if (k.startsWith(legacyPrefix)) {
      const legacyRest = k.slice(legacyPrefix.length)
      const parts = legacyRest.split('/').filter(Boolean)
      if (parts.length === 3) {
        const [y, mo, fileSeg] = parts
        if (/^\d{4}$/.test(y) && /^\d{2}$/.test(mo) && /^\d+_.+/.test(fileSeg)) {
          return true
        }
      }
    }
  }

  if (scope.customerId != null) {
    for (const gaPath of gaPathCandidates) {
      const ga = String(gaPath ?? '').trim()
      const claimPrefix = `insurer/${ga}/${userSeg}/customer-app-claims/`
      if (k.startsWith(claimPrefix)) {
        return true
      }
    }
  }

  return false
}

/**
 * @param {string} objectKey
 * @param {string} gaCode
 * @param {InsuranceStorageCategory} category
 * @param {object} [scope]
 */
export function assertInsuranceSharedStorageKey(objectKey, gaCode, category, scope = {}) {
  const k = stripInsuranceStorageKey(objectKey)
  const ga = normalizeInsuranceGaCode(gaCode)
  if (!k || !ga || k.includes('..')) {
    return false
  }

  if (isInsuranceSsotKey(k)) {
    const pathCategory = sharedCategoryPathSegment(category)
    const prefix = `${INSURANCE_STORAGE_ROOT_PREFIX}/${ga}/shared/${pathCategory}/`
    if (!k.startsWith(prefix)) {
      return false
    }
    const rest = k.slice(prefix.length)
    if (
      category === INSURANCE_STORAGE_CATEGORY.INSURER_NEWSLETTERS ||
      category === INSURANCE_STORAGE_CATEGORY.ADJUSTER_NEWSLETTERS
    ) {
      if (!/^[^/]+\/\d{4}\/\d{2}\/\d+-.+/.test(rest)) {
        return false
      }
      const codeSeg = rest.split('/')[0]
      const expectedCode = sanitizeInsurancePathSegment(
        category === INSURANCE_STORAGE_CATEGORY.INSURER_NEWSLETTERS
          ? (scope.insurerCode ?? scope.companySlug)
          : (scope.adjusterCode ?? scope.companySlug),
      )
      if (expectedCode && expectedCode !== '_' && codeSeg !== expectedCode) {
        return false
      }
      return true
    }
    if (category === INSURANCE_STORAGE_CATEGORY.SHARED_CUSTOMER_NEWSLETTERS) {
      return /^[^/]+\/\d{4}\/\d{2}\/\d+-.+/.test(rest)
    }
    if (category === INSURANCE_STORAGE_CATEGORY.GA_NOTICES) {
      return /^\d{4}\/\d{2}\/\d+-.+/.test(rest)
    }
    return rest.length > 0
  }

  if (category === INSURANCE_STORAGE_CATEGORY.INSURER_NEWSLETTERS) {
    if (k.startsWith('insurer-news/')) {
      return true
    }
    const code = sanitizeInsurancePathSegment(scope.insurerCode ?? scope.companySlug)
    if (k.startsWith(`insurer/${ga}/`) && (code ? k.includes(`/${code}/`) : true)) {
      return k.includes('/news/') || k.includes('/news/')
    }
  }

  if (category === INSURANCE_STORAGE_CATEGORY.ADJUSTER_NEWSLETTERS) {
    if (k.startsWith('insurer-news/')) {
      return true
    }
    if (k.startsWith(`insurer/${ga}/`)) {
      return k.includes('/loss-adjuster/') || k.includes('/LossAdjuster/')
    }
  }

  return false
}

/**
 * @param {string} objectKey
 * @param {string} gaCode
 * @param {string | number} teamId
 */
export function assertInsuranceTeamStorageKey(objectKey, gaCode, teamId) {
  const k = stripInsuranceStorageKey(objectKey)
  const ga = normalizeInsuranceGaCode(gaCode)
  const teamSeg = sanitizeInsurancePathSegment(teamId)
  if (!k || !ga || !teamSeg || k.includes('..')) {
    return false
  }

  const ssotPrefix = `${INSURANCE_STORAGE_ROOT_PREFIX}/${ga}/teams/${teamSeg}/${INSURANCE_STORAGE_CATEGORY.TEAM_FILES}/`
  if (k.startsWith(ssotPrefix)) {
    return /^\d{4}\/\d{2}\/\d+-.+/.test(k.slice(ssotPrefix.length))
  }

  const legacyPrefix = `teams/${ga}/${teamSeg}/attachments/`
  return k.startsWith(legacyPrefix) && k.length > legacyPrefix.length + 4
}
