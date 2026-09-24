import {
  COVERAGE_SIMULATOR_PREVIEW_MOBILE_USER_KEY,
  COVERAGE_SIMULATOR_PREVIEW_PC_USER_KEY,
} from './scenarioRepository'

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
