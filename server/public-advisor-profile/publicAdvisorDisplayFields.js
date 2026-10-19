/**
 * 공개 모바일 명함의 표시 문자열.
 * 소속은 사용자가 저장한 Hero 보조 문구만 쓰고, GA/팀 계정값은 합치지 않는다.
 * 사무실은 도로명(검색 기본주소)과 상세주소를 각각 이어 붙인다.
 */

export function resolvePublicAffiliationLine(input) {
  if (!input) return ''
  const visible = input.heroDisplaySubtitleVisible ?? input.hero_display_subtitle_visible
  if (visible === false) return ''
  const raw = input.heroDisplaySubtitle ?? input.hero_display_subtitle ?? ''
  return String(raw ?? '').trim()
}

export function buildOfficeDisplayLine(profile) {
  const road = String(profile?.office_road_address ?? profile?.officeRoadAddress ?? '').trim()
  const detail = String(profile?.office_address_detail ?? profile?.officeAddressDetail ?? '').trim()
  if (!road && !detail) return ''
  return [road, detail].filter(Boolean).join(' ')
}
