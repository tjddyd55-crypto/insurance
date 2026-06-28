/**
 * @typedef {{ type: 'text', text: string }} AdminNoticeTextBlock
 * @typedef {{ type: 'image', url: string, storageKey: string, alt?: string }} AdminNoticeImageBlock
 * @typedef {AdminNoticeTextBlock | AdminNoticeImageBlock} AdminNoticeContentBlock
 */

export const ADMIN_NOTICE_STATUSES = Object.freeze(['draft', 'published', 'archived'])

/**
 * @param {unknown} blocks
 * @returns {AdminNoticeContentBlock[]}
 */
export function normalizeContentBlocks(blocks) {
  if (!Array.isArray(blocks)) {
    throw new Error('invalid_content_blocks')
  }
  return blocks.map((block) => {
    if (!block || typeof block !== 'object') {
      throw new Error('invalid_content_blocks')
    }
    const type = String(/** @type {{ type?: unknown }} */ (block).type ?? '').trim()
    if (type === 'text') {
      return {
        type: 'text',
        text: String(/** @type {{ text?: unknown }} */ (block).text ?? ''),
      }
    }
    if (type === 'image') {
      const raw = /** @type {{ url?: unknown, storageKey?: unknown, storage_key?: unknown, alt?: unknown }} */ (block)
      const storageKey = String(raw.storageKey ?? raw.storage_key ?? '').trim()
      const url = String(raw.url ?? '').trim()
      if (!storageKey && !url) {
        throw new Error('invalid_image_block')
      }
      return {
        type: 'image',
        url,
        storageKey,
        alt: String(raw.alt ?? ''),
      }
    }
    throw new Error('invalid_block_type')
  })
}

/**
 * @param {AdminNoticeContentBlock[]} blocks
 */
export function derivePlainText(blocks) {
  return blocks
    .filter((block) => block.type === 'text')
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join('\n')
}

/**
 * @param {{ status?: unknown, showAsPopup?: unknown, startsAt?: unknown, endsAt?: unknown }} notice
 * @param {Date} [now]
 */
export function isActivePopupCandidate(notice, now = new Date()) {
  if (String(notice.status ?? '') !== 'published') {
    return false
  }
  if (notice.showAsPopup !== true) {
    return false
  }
  const startsAt = notice.startsAt ? new Date(String(notice.startsAt)) : null
  const endsAt = notice.endsAt ? new Date(String(notice.endsAt)) : null
  if (startsAt && Number.isFinite(startsAt.getTime()) && startsAt > now) {
    return false
  }
  if (endsAt && Number.isFinite(endsAt.getTime()) && endsAt < now) {
    return false
  }
  return true
}

/**
 * @param {{ popupPriority?: unknown, updatedAt?: unknown, id?: unknown }} a
 * @param {{ popupPriority?: unknown, updatedAt?: unknown, id?: unknown }} b
 */
export function comparePopupNotices(a, b) {
  const priorityDiff = Number(b.popupPriority ?? 0) - Number(a.popupPriority ?? 0)
  if (priorityDiff !== 0) {
    return priorityDiff
  }
  const updatedA = Date.parse(String(a.updatedAt ?? ''))
  const updatedB = Date.parse(String(b.updatedAt ?? ''))
  if (Number.isFinite(updatedA) && Number.isFinite(updatedB) && updatedB !== updatedA) {
    return updatedB - updatedA
  }
  return Number(b.id ?? 0) - Number(a.id ?? 0)
}

/**
 * @param {{ dismissedForever?: unknown, dismissedUntil?: unknown } | null | undefined} dismissal
 * @param {Date} [now]
 */
export function isNoticeDismissedActive(dismissal, now = new Date()) {
  if (!dismissal) {
    return false
  }
  if (dismissal.dismissedForever === true) {
    return true
  }
  const until = dismissal.dismissedUntil ? new Date(String(dismissal.dismissedUntil)) : null
  return Boolean(until && Number.isFinite(until.getTime()) && until >= now)
}
