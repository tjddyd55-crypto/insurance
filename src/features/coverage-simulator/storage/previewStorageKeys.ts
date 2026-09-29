import {
  COVERAGE_SIMULATOR_PREVIEW_MOBILE_USER_KEY,
  COVERAGE_SIMULATOR_PREVIEW_PC_USER_KEY,
} from './scenarioRepository'

const CRM_TEMPLATE_STORAGE_PREFIX = 'onefc:coverage-simulator:templates:v1'
const LIBRARY_INIT_PREFIX = 'onefc:coverage-simulator:library-init:v1'

export function previewConsultationStorageKey(userKey: string): string | null {
  if (userKey === COVERAGE_SIMULATOR_PREVIEW_PC_USER_KEY) {
    return 'coverage-simulator-preview-pc:consultations:v1'
  }
  if (userKey === COVERAGE_SIMULATOR_PREVIEW_MOBILE_USER_KEY) {
    return 'coverage-simulator-preview-mobile:consultations:v1'
  }
  return null
}

export function previewTemplateStorageKey(userKey: string): string | null {
  if (userKey === COVERAGE_SIMULATOR_PREVIEW_PC_USER_KEY) {
    return 'coverage-simulator-preview-pc:templates:v1'
  }
  if (userKey === COVERAGE_SIMULATOR_PREVIEW_MOBILE_USER_KEY) {
    return 'coverage-simulator-preview-mobile:templates:v1'
  }
  return null
}

export function templateStorageKey(userKey: string): string | null {
  const preview = previewTemplateStorageKey(userKey)
  if (preview) return preview
  if (!userKey) return null
  return `${CRM_TEMPLATE_STORAGE_PREFIX}:${userKey}`
}

export function scenarioLibraryInitStorageKey(userKey: string): string | null {
  if (!userKey) return null
  return `${LIBRARY_INIT_PREFIX}:${userKey}`
}

export function previewLegacyConsultationStorageKey(userKey: string): string | null {
  if (userKey === COVERAGE_SIMULATOR_PREVIEW_PC_USER_KEY) {
    return 'coverage-simulator-preview-pc:v1'
  }
  if (userKey === COVERAGE_SIMULATOR_PREVIEW_MOBILE_USER_KEY) {
    return 'coverage-simulator-preview-mobile:v1'
  }
  return null
}

export function isPreviewUserKey(userKey: string): boolean {
  return (
    userKey === COVERAGE_SIMULATOR_PREVIEW_PC_USER_KEY ||
    userKey === COVERAGE_SIMULATOR_PREVIEW_MOBILE_USER_KEY
  )
}
