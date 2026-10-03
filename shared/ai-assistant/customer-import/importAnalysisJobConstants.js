export const IMPORT_ANALYSIS_JOB_STATUS = Object.freeze({
  QUEUED: 'QUEUED',
  ANALYZING: 'ANALYZING',
  SEMANTIC_ENRICHING: 'SEMANTIC_ENRICHING',
  PIPELINE_RUNNING: 'PIPELINE_RUNNING',
  PREVIEW_READY: 'PREVIEW_READY',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
})

/** Bump when semantic/GPT policy changes to invalidate cached analysis jobs. */
export const IMPORT_ANALYSIS_SEMANTIC_CONFIG_VERSION = 'semantic-v2-async'

export const IMPORT_ANALYSIS_JOB_DISPLAY = Object.freeze({
  QUEUED: '분석 대기 중',
  ANALYZING: '파일 확인 중',
  SEMANTIC_ENRICHING: 'AI 의미 분석 중',
  PIPELINE_RUNNING: '중복·등록 가능 여부 확인 중',
  PREVIEW_READY: '미리보기 준비 완료',
  FAILED: '분석 실패',
  CANCELLED: '분석 취소됨',
})
