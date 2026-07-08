/**
 * 원수사 소식지 "표시 전용" 텍스트 정규화.
 *
 * 배경:
 * - 작성 폼(InsurerNewsForm)은 본문이 비어 있을 때 summary 를 '요약 없음' 으로 저장해 왔고,
 *   상세 화면은 본문이 비어 있으면 '본문이 없습니다.' 문구를 그대로 노출했다.
 * - 이미지만 올린 소식지에서는 이런 자동 placeholder 가 실제 내용처럼 보여 어색했다.
 *
 * 정책:
 * - 저장/업로드/조회 로직은 건드리지 않는다. 이미 저장된 sentinel 값과 신규 데이터를
 *   모두 "표시 단계 한 곳" 에서 빈 텍스트로 취급해, 텍스트가 없으면 아예 렌더하지 않는다.
 * - 원수사 소식지 범위(features/insurer-news)에서만 사용해 다른 공지/자료실/고객소식지에
 *   영향이 가지 않게 한다.
 */
const INSURER_NEWS_PLACEHOLDER_TEXTS: ReadonlySet<string> = new Set([
  '요약 없음',
  '본문 없음',
  '본문이 없습니다',
  '본문이 없습니다.',
  '본문 내용이 없습니다.',
  '내용 없음',
  '설명 없음',
])

/**
 * sentinel placeholder 문구는 빈 문자열로, 그 외에는 앞뒤 공백만 정리한 값을 반환한다.
 * 본문 내부의 줄바꿈은 그대로 보존한다(HTML 이 아니라 plain text 렌더 기준).
 */
export function normalizeInsurerNewsText(value?: string | null): string {
  const text = String(value ?? '').trim()
  if (!text) {
    return ''
  }
  return INSURER_NEWS_PLACEHOLDER_TEXTS.has(text) ? '' : text
}

/** 표시할 실제 텍스트가 있는지 여부. */
export function hasInsurerNewsText(value?: string | null): boolean {
  return normalizeInsurerNewsText(value).length > 0
}
