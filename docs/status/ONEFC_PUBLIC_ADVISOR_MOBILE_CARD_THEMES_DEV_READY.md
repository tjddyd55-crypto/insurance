# ONEFC_PUBLIC_ADVISOR_MOBILE_CARD_THEMES_DEV_READY

Development (`develop`) — 모바일 공개 프로필 `/fc/:slug` Hero 테마 3종.

## Themes

| DB / API `profileTheme` | Hero |
|-------------------------|------|
| `classic` (default) | 기존 빌보드형 |
| `brand` | ONE FC blue 디지털 명함 |
| `premium` | 대형 사진 + gradient overlay |

- Column: `advisor_public_profiles.profile_theme`
- CRM: `/profile/public-advisor` → **모바일 명함 디자인**
- Public API: `GET /api/public/advisors/:slug` → `profileTheme`

## QA

- Slug: `qa-public-advisor-dev` (user `qa_ai_user`)
- Screenshots: `scripts/qa/capture-mobile-fc-themes.mjs` → `scripts/qa/screenshots/mobile-fc-themes/`
- Viewports: 360 / 390 / 430 (capture script uses 390)

## Not in scope

- Production / `main`
- Separate pages, slugs, or public API routes
- Gallery / sticky / consultation layout per theme
