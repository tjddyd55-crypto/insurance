/**
 * 랜딩 마크업 구조에 종속된 상수.
 *
 * 카피(문구)는 `config/introductionLandingContent.ts` 가 SSOT 다.
 * 이 파일에는 "브랜드 표기"와 "DOM id 규약"처럼 컴포넌트 구조와 붙어 있는 값만 둔다.
 * 컴포넌트를 export 하지 않으므로 react-refresh 경계와도 충돌하지 않는다.
 */

export const INTRO_BRAND_NAME = 'ONE FC'

/** 섹션 배경 톤. CSS `intro-landing-section--{tone}` 와 1:1 대응한다. */
export type IntroSectionTone = 'hero' | 'light' | 'soft' | 'accent'

/** 섹션 제목 element id 규약. heading 과 aria-labelledby 가 같은 값을 쓰도록 강제한다. */
export function introSectionTitleId(sectionId: string): string {
  return `${sectionId}-title`
}
