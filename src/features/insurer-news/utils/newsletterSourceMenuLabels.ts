import type { NewsletterSourceKind } from '../types'

/**
 * 소식지 종류 필터의 사용자 표시 이름.
 * 키(INSURER/GA/PUBLIC)는 필터 값으로 유지하고, 문구는 앱 메뉴 라벨과 맞춘다.
 * - 원수사소식지: gaTenantMenu 사용자 메뉴 `/portal/newsletters`
 * - GA전용 소식지: gaTenantMenu 관리 메뉴 `GA전용 소식지 관리` 의 화면 이름
 * - 공용 게시판: 게시판 관리에서 쓰는 공용 보드 이름
 */
export const NEWSLETTER_SOURCE_KIND_MENU: Record<
  NewsletterSourceKind,
  { code: NewsletterSourceKind; label: string; menuPath: string }
> = {
  INSURER: { code: 'INSURER', label: '원수사소식지', menuPath: '/portal/newsletters' },
  GA: { code: 'GA', label: 'GA전용 소식지', menuPath: '/admin/newsletter-boards' },
  PUBLIC: { code: 'PUBLIC', label: '공용 게시판', menuPath: '/portal/boards' },
}

export const INSURER_NEWSLETTER_FEED_CODE = 'insurer'

/** 소식지 필터의 '전체' 옵션 표시 이름 (소식지 목록 상단 `전체 소식지` 칩과 동일 문구). */
export const NEWSLETTER_ALL_FILTER_LABEL = '전체 소식지'
