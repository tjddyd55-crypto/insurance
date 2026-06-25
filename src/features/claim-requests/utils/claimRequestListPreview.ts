import type { ClaimRequestListItem } from '../api/claimRequestsApi'

export function claimRequestListPreviewText(item: Pick<ClaimRequestListItem, 'memo' | 'title'>): string {
  const memo = item.memo?.trim()
  const title = item.title?.trim()
  const raw = memo || title || ''
  if (!raw) {
    return '내용 없음'
  }
  if (raw.length <= 140) {
    return raw
  }
  return `${raw.slice(0, 137)}…`
}
