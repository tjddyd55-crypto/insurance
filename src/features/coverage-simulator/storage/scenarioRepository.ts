import type { CoverageScenario, DiseaseType, SavedScenarioSummary } from '../domain/types'
import {
  deleteConsultation,
  filterConsultationsByDisease,
  getConsultationById,
  listConsultations,
  saveConsultation,
} from './consultationRepository'

/** @deprecated Preview는 consultations 키 사용. 하위 호환 alias */
export const COVERAGE_SIMULATOR_PREVIEW_PC_STORAGE_KEY = 'coverage-simulator-preview-pc:consultations:v1'
export const COVERAGE_SIMULATOR_PREVIEW_MOBILE_STORAGE_KEY = 'coverage-simulator-preview-mobile:consultations:v1'

export const COVERAGE_SIMULATOR_PREVIEW_PC_USER_KEY = '__coverage_sim_preview_pc__'
export const COVERAGE_SIMULATOR_PREVIEW_MOBILE_USER_KEY = '__coverage_sim_preview_mobile__'

export const listSavedScenarios = listConsultations
export const getScenarioById = getConsultationById
export const saveScenario = saveConsultation
export const deleteScenario = deleteConsultation
export const filterSavedByDisease = filterConsultationsByDisease

export type { CoverageScenario, SavedScenarioSummary, DiseaseType }
