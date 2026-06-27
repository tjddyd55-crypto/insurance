import {
  formatKstDate,
  formatKstDateDots,
  formatKstDateTimeParts,
  getKstDateString,
} from '../../../utils/displayDateTime'

export function parseMemoContent(content: string): { title: string; preview: string } {
  const trimmed = content.trim()
  if (!trimmed) {
    return { title: '메모', preview: '' }
  }
  const lines = trimmed.split('\n')
  const titleLine = lines.find((line) => line.trim())?.trim() ?? '메모'
  const titleIndex = lines.findIndex((line) => line.trim())
  const rest = lines.slice(titleIndex + 1).join('\n').trim()
  return {
    title: titleLine,
    preview: rest || trimmed,
  }
}

/** 모바일 메모 리스트 수정일 — 오늘: 시간, 올해: M월 D일, 이전: YYYY.MM.DD */
export function formatMemoListUpdatedAt(value: string | null | undefined, now = new Date()): string {
  if (value == null || String(value).trim() === '') {
    return ''
  }
  const noteDate = formatKstDate(value)
  if (!noteDate) {
    return ''
  }
  const today = getKstDateString(now)
  if (noteDate === today) {
    return formatKstDateTimeParts(value)?.time ?? ''
  }
  const noteYear = noteDate.slice(0, 4)
  const thisYear = today.slice(0, 4)
  if (noteYear === thisYear) {
    const month = Number(noteDate.slice(5, 7))
    const day = Number(noteDate.slice(8, 10))
    return `${month}월 ${day}일`
  }
  return formatKstDateDots(value)
}

export function noteUpdatedTimestamp(note: { updatedAt?: string | null; createdAt?: string | null }): number {
  const updated = note.updatedAt ? Date.parse(note.updatedAt) : NaN
  if (Number.isFinite(updated)) {
    return updated
  }
  const created = note.createdAt ? Date.parse(note.createdAt) : NaN
  return Number.isFinite(created) ? created : 0
}
