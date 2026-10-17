# ONEFC_PUBLIC_ADVISOR_DEV_SWITCHER_REMOVED

Development only — `/fc/:slug` 공개 프로필 상단 DEV Hero 테마 검수 바(1안/2안/3안) 제거.

## 변경 요약

| 영역 | 내용 |
|------|------|
| 공개 `/fc/:slug` | DB `profile_theme`만 사용. Hero가 페이지 최상단 |
| 편집 `/profile/mobile-card` | `AdvisorMobileCardThemePicker` 유지, Live Preview는 공개와 동일 구조 |
| 제거 | `AdvisorThemeDevSwitcher`, `advisorThemeDevReviewGate*`, `pap-dev-theme-review*` CSS, `topSlot` |

## QA (Dev)

- URL: `https://insurance-dev.up.railway.app/fc/qa-public-advisor-dev`
- 390px: DEV bar 없음, `heroTopPx` ≈ 0
- 편집기에서 Classic / Brand / Premium 선택 → Live Preview 즉시 반영
- 저장 후 공개 페이지 새로고침 → 저장 theme 일치

## 이전 문서

`ONEFC_PUBLIC_ADVISOR_DEV_THEME_REVIEW_SWITCHER_READY.md` — superseded (검수 switcher는 제거됨).
