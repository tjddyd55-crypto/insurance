/**
 * @deprecated Use provisionStoreReviewAccount.js with profile "google".
 */
export {
  STORE_REVIEW_PROFILES,
  provisionStoreReviewAccount,
  verifyStoreReviewAccount,
  testStoreReviewLoginAndAccess,
  assertStoreReviewProductionGuard,
  resolveStoreReviewProfile,
  STORE_REVIEW_GA_CODE as REVIEW_GA_CODE,
  STORE_REVIEW_GA_NAME as REVIEW_GA_NAME,
  STORE_REVIEW_TENANT_CODE as REVIEW_TENANT_CODE,
  STORE_REVIEW_INDUSTRY_CODE as REVIEW_INDUSTRY_CODE,
} from './provisionStoreReviewAccount.js'

export const REVIEW_USERNAME = 'google_review'
export const REVIEW_DISPLAY_NAME = 'Google Review'
