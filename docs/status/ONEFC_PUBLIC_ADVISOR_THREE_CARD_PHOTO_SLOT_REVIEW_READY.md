# ONEFC_PUBLIC_ADVISOR_THREE_CARD_PHOTO_SLOT_REVIEW_READY

Development only — 1안/2안/3안 Hero 대표사진 슬롯 명확화.

| 안 | 슬롯 | 구현 |
|----|------|------|
| 1안 Classic | 4:5 full-width billboard | `AdvisorHeroPortraitSlot` + `pap-hero-photo-wrap--portrait` |
| 2안 Brand | 원형 프로필 (blue block 겹침) | `pap-hero-brand__photo-ring--portrait` (196px cap) |
| 3안 Premium | 전체 cover + 하단 glass panel | `pap-hero-premium__panel` |

- 공통: `src/features/public-advisor/components/heroes/AdvisorHeroPortraitSlot.tsx`
- CRM: `AdvisorMobileCardThemePicker` live scale 0.58 / 높이 252px
- DEV switcher: 유지, DB 미변경

## 캡처

`node scripts/qa/capture-public-advisor-photo-slots.mjs`  
→ `scripts/qa/screenshots/public-advisor-photo-slots/`

## QA

`https://insurance-dev.up.railway.app/fc/qa-public-advisor-dev`
