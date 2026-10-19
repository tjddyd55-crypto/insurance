/** 공개 명함 공유 제목·설명. 서버 HTML 주입과 클라이언트 document.title/공유가 이 함수만 쓴다. */

export const ADVISOR_SHARE_TITLE_FALLBACK = '모바일 명함'
export const ADVISOR_SHARE_DESCRIPTION_FALLBACK = '모바일 명함'
export const ADVISOR_SHARE_UNAVAILABLE_TITLE = '프로필을 찾을 수 없습니다'
export const ADVISOR_SHARE_UNAVAILABLE_DESCRIPTION = '비공개이거나 존재하지 않는 설계사 프로필입니다.'

const MAX_SHARE_TEXT = 200

function line(value) {
  return String(value ?? '').trim()
}

function isShown(visible) {
  return visible === true
}

/**
 * 1. 보이는 Hero 대표 표시 이름
 * 2. 없으면 사용자 displayName
 * 상단 라벨(브랜드)과 보조 문구는 제목에 넣지 않는다.
 *
 * @param {{
 *   displayName?: string | null
 *   heroDisplayTitle?: string | null
 *   heroDisplayTitleVisible?: boolean | null
 * }} input
 */
export function buildAdvisorOgTitle(input) {
  const heroTitle = isShown(input?.heroDisplayTitleVisible) ? line(input?.heroDisplayTitle) : ''
  if (heroTitle) return heroTitle.slice(0, MAX_SHARE_TEXT)
  const name = line(input?.displayName)
  return (name || ADVISOR_SHARE_TITLE_FALLBACK).slice(0, MAX_SHARE_TEXT)
}

/**
 * 1. 한 줄 소개
 * 2. 보이는 보조 소속/직책
 * 3. 브랜드명을 강제하지 않는 짧은 기본 문구
 *
 * @param {{
 *   headline?: string | null
 *   heroDisplaySubtitle?: string | null
 *   heroDisplaySubtitleVisible?: boolean | null
 * }} input
 */
export function buildAdvisorOgDescription(input) {
  const headline = line(input?.headline)
  if (headline) return headline.slice(0, MAX_SHARE_TEXT)
  const subtitle = isShown(input?.heroDisplaySubtitleVisible) ? line(input?.heroDisplaySubtitle) : ''
  if (subtitle) return subtitle.slice(0, MAX_SHARE_TEXT)
  return ADVISOR_SHARE_DESCRIPTION_FALLBACK
}
