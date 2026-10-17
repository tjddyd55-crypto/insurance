# ONEFC_PUBLIC_ADVISOR_MOBILE_CARD_UI_POLISH_ROUND2_READY

**Scope:** Development (`develop`) only. Production / `main` unchanged.

## Summary

| Item | Status | Notes |
|------|--------|-------|
| 명함 back UI 제거 | Done | CRM, 공개 섹션, Lightbox, 액션바(앞면 등록 시만) |
| 명함 비율 90:50 | Done | `aspect-ratio: 90 / 50`, `object-fit: contain`, white + border |
| 3안 Premium 오버레이 | Done | Panel `rgba(10, 30, 55, 0.5)` (was 0.58); scrim gradient lightened |
| 4안 | N/A | `classic` / `brand` / `premium` only — no new theme |
| 섹션 제목 제거 | Done | 소개 / 내 명함 / 활동 모습 / 상담 문의 (facts keep sr-only) |
| White card radius 0 | Done | `.pap-home-sections .pap-fc-card` |
| API back 노출 | Done | Public + owner GET return `businessCardBackUrl: null` (DB column retained) |

## QA (390px)

Run after deploy:

```bash
node scripts/qa/capture-mobile-card-polish-round2.mjs
```

Captures: `scripts/qa/screenshots/mobile-card-polish-round2/`

- `01-classic-updated.png`
- `02-brand-updated.png`
- `03-premium-updated.png`
- `04-business-card-front-only.png`
- `05-mobile-card-editor-front-only.png`

Optional premium before/after: compare `03-premium-with-business-card.png` (prior QA folder) vs `03-premium-updated.png`.

## Key files

- `src/features/public-advisor/components/AdvisorBusinessCardSection.tsx`
- `src/features/public-advisor/pages/PublicAdvisorProfilePage.tsx`
- `src/features/public-advisor/pages/MyPublicProfilePage.tsx`
- `src/features/public-advisor/public-advisor.css`
- `server/public-advisor-profile/registerPublicAdvisorProfileApi.js`
