/** "오전 12:00" / "오후 9:30" → 24h "HH:mm". 파싱 실패 시 null. */
export function parseKoreanTime(label: string): string | null {
  const match = /^(오전|오후)\s*(\d{1,2}):(\d{2})$/.exec(label.trim())
  if (!match) {
    return null
  }

  const period = match[1]
  let hour = Number(match[2])
  const minute = Number(match[3])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null
  }
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return null
  }

  if (period === '오전') {
    hour = hour === 12 ? 0 : hour
  } else {
    hour = hour === 12 ? 12 : hour + 12
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}
