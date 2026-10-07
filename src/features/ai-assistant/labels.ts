import type {
  AiToolActionType,
  AiToolBaseFeatureStatus,
  AiToolImplementationStatus,
  AiToolQaStatus,
} from './types'

export const AI_TOOL_CATEGORY_LABELS: Record<string, string> = {
  AI_CORE: 'AI 코어',
  VOICE: '음성',
  FILE: '파일',
  CUSTOMER: '고객',
  CUSTOMER_IMPORT: 'AI 스마트 고객 가져오기',
  CONSULTATION: '상담',
  MEMO: '메모',
  TASK: '할일',
  SCHEDULE: '일정',
  GOOGLE_CALENDAR: 'Google Calendar',
  CLAIM: '청구',
  CONTRACT: '계약',
  COVERAGE: '보장분석',
  SMS: '문자',
  ALIMTALK: '알림톡',
  DOCUMENT: '문서',
  ESIGN: '전자서명',
  ACCOUNT_VAULT: '계정 보관함',
  DAILY_TA: '오늘의 TA',
  REPORT: '리포트',
  AI_MEMORY: 'AI 메모리',
  ORGANIZATION: '조직·권한',
}

export function categoryLabel(category: string): string {
  return AI_TOOL_CATEGORY_LABELS[category] ?? category
}

const BASE_FEATURE_LABELS: Record<AiToolBaseFeatureStatus, string> = {
  AVAILABLE: '존재',
  PARTIAL: '일부',
  NOT_AVAILABLE: '없음',
}

const IMPLEMENTATION_LABELS: Record<AiToolImplementationStatus, string> = {
  NOT_STARTED: '미개발',
  IN_PROGRESS: '개발중',
  IMPLEMENTED: '연결완료',
  BLOCKED: '차단',
}

const QA_LABELS: Record<AiToolQaStatus, string> = {
  NOT_TESTED: '미테스트',
  TESTING: '테스트중',
  PASSED: 'PASS',
  FAILED: '실패',
}

const ACTION_LABELS: Record<AiToolActionType, string> = {
  READ: 'READ',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  SEND: 'SEND',
  EXTERNAL_ACTION: 'EXTERNAL',
}

export function baseFeatureLabel(status: AiToolBaseFeatureStatus): string {
  return BASE_FEATURE_LABELS[status]
}

export function implementationLabel(status: AiToolImplementationStatus): string {
  return IMPLEMENTATION_LABELS[status]
}

export function qaLabel(status: AiToolQaStatus): string {
  return QA_LABELS[status]
}

export function actionTypeLabel(action: AiToolActionType): string {
  return ACTION_LABELS[action]
}

export function confirmationLabel(requires: boolean): string {
  return requires ? '필요' : '없음'
}

export function productionLabel(enabled: boolean): string {
  return enabled ? 'ON' : 'OFF'
}

export type StatusFilterKey =
  | 'all'
  | 'not_started'
  | 'in_progress'
  | 'implemented'
  | 'qa_needed'
  | 'qa_pass'
  | 'production_on'
  | 'qa_failed'
  | 'blocked'

export const STATUS_FILTER_OPTIONS: { key: StatusFilterKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'not_started', label: '미개발' },
  { key: 'in_progress', label: '개발중' },
  { key: 'implemented', label: '연결완료' },
  { key: 'qa_needed', label: 'QA 필요' },
  { key: 'qa_pass', label: 'QA PASS' },
  { key: 'production_on', label: '운영중' },
  { key: 'qa_failed', label: '실패' },
  { key: 'blocked', label: '차단' },
]
