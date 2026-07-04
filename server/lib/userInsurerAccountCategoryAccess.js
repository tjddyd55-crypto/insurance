/** @typedef {'LIFE' | 'NON_LIFE' | 'GENERAL'} UserInsurerAccountCategory */

/** 본인 계정관리 — 전체 카테고리 */
export const ALL_USER_INSURER_ACCOUNT_CATEGORIES = /** @type {const} */ (['LIFE', 'NON_LIFE', 'GENERAL'])

/** 공유·공개 URL — 생명/손해만 허용 */
export const SHARED_USER_INSURER_ACCOUNT_CATEGORIES = /** @type {const} */ (['LIFE', 'NON_LIFE'])

/** shared/public API handler 에 넘길 options */
export const SHARED_ACCOUNT_CATEGORY_ACCESS = {
  allowedCategories: SHARED_USER_INSURER_ACCOUNT_CATEGORIES,
}

/**
 * @param {unknown} category
 * @param {readonly UserInsurerAccountCategory[] | undefined} allowedCategories
 * @param {'create' | 'patch' | 'delete'} operation
 */
export function assertAllowedAccountCategory(category, allowedCategories, operation = 'create') {
  if (!Array.isArray(allowedCategories) || allowedCategories.length === 0) {
    return
  }
  const normalized = String(category ?? '').trim().toUpperCase()
  if (!allowedCategories.includes(normalized)) {
    const error = new Error('shared_account_category_not_allowed')
    error.code = 'shared_account_category_not_allowed'
    error.operation = operation
    throw error
  }
}

/**
 * @param {Array<{ category?: string }>} accounts
 * @param {readonly UserInsurerAccountCategory[] | undefined} allowedCategories
 */
export function filterAccountsByAllowedCategories(accounts, allowedCategories) {
  if (!Array.isArray(allowedCategories) || allowedCategories.length === 0) {
    return accounts
  }
  const allowed = new Set(allowedCategories)
  return accounts.filter((row) => allowed.has(String(row.category ?? '').trim().toUpperCase()))
}

/**
 * @param {Error & { code?: string, operation?: string }} error
 */
export function sharedAccountCategoryNotAllowedMessage(error) {
  switch (error?.operation) {
    case 'patch':
      return '공유 화면에서는 일반 계정을 수정할 수 없습니다.'
    case 'delete':
      return '공유 화면에서는 일반 계정을 삭제할 수 없습니다.'
    default:
      return '공유 화면에서는 일반 계정을 추가할 수 없습니다.'
  }
}
