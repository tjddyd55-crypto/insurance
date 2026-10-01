import { formatKstDate, getKstDateString } from '../../../utils/displayDateTime'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export type CoverageWrittenRecord = {
  createdAt?: string | null
  consultationDate?: string | null
}

/**
 * 보장 시뮬레이터 달력일.
 * `YYYY-MM-DD` 는 저장된 상담일이므로 다시 옮기지 않는다.
 * timestamp 는 Asia/Seoul 달력일이다. `toISOString().slice(0, 10)` 은 UTC 날짜라 금지.
 */
export function formatCoverageSeoulYmd(value: string | Date | null | undefined): string {
  if (value == null || value === '') return ''
  if (typeof value === 'string' && DATE_ONLY.test(value.trim())) return value.trim()
  return formatKstDate(value)
}

export function formatCoverageSeoulDots(value: string | Date | null | undefined, empty: string): string {
  const ymd = formatCoverageSeoulYmd(value)
  return ymd ? ymd.replace(/-/g, '.') : empty
}

/** 작성일 원천. createdAt 이 있으면 그 시각, 없으면 저장된 consultationDate. */
export function coverageWrittenSource(record: CoverageWrittenRecord): string {
  const createdAt = record.createdAt?.trim()
  if (createdAt) return createdAt
  return record.consultationDate?.trim() ?? ''
}

/** 목록·PDF·공개 공유가 같이 쓰는 작성일. */
export function formatCoverageAuthoredDate(record: CoverageWrittenRecord, empty: string): string {
  return formatCoverageSeoulDots(coverageWrittenSource(record), empty)
}

/** 목록 작성·수정일. 비어 있으면 `—`. */
export function formatConsultationListDate(iso: string | undefined | null): string {
  return formatCoverageSeoulDots(iso, '—')
}

/** PDF·인쇄 헤더 작성일. createdAt 이 있으면 서울 시각을 쓴다. */
export function formatCoveragePrintDate(record: CoverageWrittenRecord): string {
  return formatCoverageAuthoredDate(record, '—')
}

/** 공유 페이지 메타. 비어 있으면 줄을 생략할 수 있게 빈 문자열. */
export function formatCoverageShareMetaDate(record: CoverageWrittenRecord): string {
  return formatCoverageAuthoredDate(record, '')
}

export function seoulTodayYmd(now: Date = new Date()): string {
  return getKstDateString(now)
}
