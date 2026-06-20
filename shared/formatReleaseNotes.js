/**
 * electron-updater / GitHub Release 노트를 UI 표시용 plain text로 변환한다.
 * HTML 태그·엔티티를 제거하고 줄바꿈만 유지한다.
 *
 * @param {unknown} input
 * @returns {string}
 */
export function formatReleaseNotes(input) {
  if (!input) {
    return '업데이트 내용이 없습니다.'
  }

  const raw = Array.isArray(input)
    ? input
        .map((item) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object' && 'note' in item) {
            const note = item.note
            return typeof note === 'string' ? note : String(note ?? '')
          }
          return String(item ?? '')
        })
        .join('\n')
    : String(input)

  const text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text || '업데이트 내용이 없습니다.'
}
