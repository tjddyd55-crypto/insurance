export const BINDER_EMPTY_SECTION_MESSAGE = '이 섹션에는 아직 자료가 없습니다.'

/** 자료가 있는 섹션은 페이지 이동, 빈 섹션은 공통 빈 안내. */
export function binderTocSectionAction(itemCount: number): 'navigate' | 'empty' {
  return itemCount > 0 ? 'navigate' : 'empty'
}
