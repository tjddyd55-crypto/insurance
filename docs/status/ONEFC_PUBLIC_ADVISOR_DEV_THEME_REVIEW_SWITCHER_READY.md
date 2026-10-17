# ONEFC_PUBLIC_ADVISOR_DEV_THEME_REVIEW_SWITCHER_READY

Development only — `/fc/:slug` 상단 임시 Hero 테마 비교 바.

| 검수 표기 | `profile_theme` | Hero |
|-----------|-----------------|------|
| 1안 | `classic` | `AdvisorProfileHeroClassic` |
| 2안 | `brand` | `AdvisorProfileHeroBrand` |
| 3안 | `premium` | `AdvisorProfileHeroPremium` |

## 구현

- **Switcher:** `src/features/public-advisor/components/AdvisorThemeDevSwitcher.tsx` (`components/dev/` 는 `.gitignore` 의 `dev/` 로 추적 불가)
- **Env gate:** `src/features/public-advisor/config/advisorThemeDevReviewGate.ts`  
  (`resolveAiSecretaryUserUiEnabled` 와 동일 정책 — Vite dev, non-prod 번들, `insurance-dev.up.railway.app`)
- **페이지 연동:** `PublicAdvisorProfilePage.tsx` — `devReviewHeroTheme` local state, Hero·`actionBarTheme`·`pap-page-theme--*` 만 오버라이드
- **DB/API/URL:** 변경 없음. 새로고침 시 저장된 `profile_theme` 복귀.

## QA (Dev)

- URL: `https://insurance-dev.up.railway.app/fc/qa-public-advisor-dev`
- 390px: 1안/2안/3안 전환, 하단 섹션·sticky CTA 동일, 연속 클릭·스크롤 안정

## 제거

디자인 확정 후 `AdvisorThemeDevSwitcher`, `advisorThemeDevReviewGate*`, `public-advisor.css` 의 `pap-dev-theme-review*` 블록, 페이지 내 DEV REVIEW state 제거.
