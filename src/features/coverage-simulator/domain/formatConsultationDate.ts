/** ISO timestamp → 목록용 `YYYY.MM.DD` */
export function formatConsultationListDate(iso: string | undefined | null): string {
  if (!iso) return '—'
  const datePart = iso.slice(0, 10)
  const [y, m, d] = datePart.split('-')
  if (!y || !m || !d) return '—'
  return `${y}.${m}.${d}`
}
