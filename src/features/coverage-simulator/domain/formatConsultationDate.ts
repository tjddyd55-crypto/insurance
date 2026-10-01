import { formatKstDate, getKstDateString } from '../../../utils/displayDateTime'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const SEOUL_CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/**
 * 보장 시뮬레이터 달력일.
 * `YYYY-MM-DD` 는 이미 상담일 컬럼이므로 다시 옮기지 않는다.
 * timestamp 는 Asia/Seoul 달력일로 바꾼다. `toISOString().slice(0, 10)` 은 UTC 날짜라 금지.
 */
export function formatCoverageSeoulYmd(value: string | Date | null | undefined): string {
  if (value == null || value === '') return ''
  if (typeof value === 'string') {
    const raw = value.trim()
    if (DATE_ONLY.test(raw)) return raw
  }
  return formatKstDate(value)
}

export function formatCoverageSeoulDots(
  value: string | Date | null | undefined,
  empty = '',
): string {
  const ymd = formatCoverageSeoulYmd(value)
  return ymd ? ymd.replace(/-/g, '.') : empty
}

export type CoverageWrittenRecord = {
  createdAt?: string | null
  consultationDate?: string | null
}

/** 작성일은 createdAt 시각의 서울 달력일을 우선한다. 없을 때만 consultationDate. */
export function coverageWrittenSource(record: CoverageWrittenRecord): string {
  const createdAt = record.createdAt?.trim()
  if (createdAt) return createdAt
  return record.consultationDate?.trim() ?? ''
}

export function formatCoverageAuthoredDate(record: CoverageWrittenRecord, empty: string): string {
  return formatCoverageSeoulDots(coverageWrittenSource(record), empty)
}

/** 목록 작성·수정일. 비어 있으면 `—`. */
export function formatConsultationListDate(iso: string | undefined | null): string {
  return formatCoverageSeoulDots(iso, '—')
}

/** PDF·인쇄 헤더 작성일. 비어 있으면 `—`. */
export function formatCoveragePrintDate(consultationDate: string | undefined | null): string {
  return formatCoverageSeoulDots(consultationDate, '—')
}

/** 공유 페이지 메타. 비어 있으면 줄을 생략할 수 있게 빈 문자열. */
export function formatCoverageShareMetaDate(consultationDate: string | undefined | null): string {
  return formatCoverageSeoulDots(consultationDate, '')
}

/** 공유 이력. `YYYY.MM.DD HH:mm` (서울). */
export function formatCoverageSeoulDateTimeLabel(iso: string | undefined | null): string {
  if (!iso) return ''
  const dateLabel = formatCoverageSeoulDots(iso)
  if (!dateLabel) return iso
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return `${dateLabel} ${SEOUL_CLOCK.format(parsed)}`
}

export function seoulTodayYmd(now: Date = new Date()): string {
  return getKstDateString(now)
}
