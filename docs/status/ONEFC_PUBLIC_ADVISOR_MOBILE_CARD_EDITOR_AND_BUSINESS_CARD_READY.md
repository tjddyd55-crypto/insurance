# ONEFC_PUBLIC_ADVISOR_MOBILE_CARD_EDITOR_AND_BUSINESS_CARD_READY

Development only.

## A. 공개 UI

- **상단 여백:** `pap-page--fc` / `pap-shell--fc` padding-top 0, Hero `padding-top` 0, `app-root--advisor-public .main-container` padding 0
- **Premium glass:** `pap-hero-premium__panel` `rgba(10, 30, 55, 0.58)` + lighter scrim
- **실제 명함:** `business_card_front_object_key` / `business_card_back_object_key` → R2 `…/business-card/front|back-*.webp`
- **공개 순서:** Hero → 액션바 → 소개 → **내 명함** → 활동 → 정보 → 상담
- **액션바 명함:** 이미지 있을 때만, Lightbox 즉시 오픈

## B. CRM

- **메뉴:** `모바일 명함` → `/profile/mobile-card` (SSOT: `MyPublicProfilePage`, `/profile/public-advisor` alias 유지)
- **내정보:** `ProfilePage` 링크 동일 경로
- **편집:** 대표사진 · 명함 디자인 1/2/3 · 실제 명함 앞/뒤 · 텍스트/갤러리/연락 · 390px 미리보기

## OG 공유 썸네일

- `og:title` = `{이름} {호칭} | ONE FC`
- `og:description` = `{GA · 지점} · {한 줄 소개}` (소개 없으면 기본 문구)
- `og:image` = `/api/public/advisors/:slug/og-card.png` (1200×630, `profile_theme`별 렌더)
- 대표사진 없음 → `/icon.png` fallback
- 비공개 → `noindex` + 기본 이미지

## QA

`https://insurance-dev.up.railway.app/fc/qa-public-advisor-dev`
