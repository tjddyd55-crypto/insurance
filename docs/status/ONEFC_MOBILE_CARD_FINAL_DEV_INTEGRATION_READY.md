# ONEFC_MOBILE_CARD_FINAL_DEV_INTEGRATION_READY

Development (`develop`) only — mobile card 통합 QA + OG timeout fix.

## OG timeout root cause

- Dev QA 프로필 대표사진이 **손상·초소형 PNG(78 bytes)** 로 R2에 저장되어 있었음.
- `renderAdvisorMobileCardOgPng`가 `position: 'attention'` + 원본 decode 경로에서 **Linux(Sharp/libvips) 환경에서 장시간 hang** → `/og-card.png` 60~120s+ 무응답.
- OG 경로는 **self HTTP fetch 없음** — `readAdvisorPublicMediaBuffer` → R2 `consentGetBuffer` 직접 읽기.

## Fix (develop)

- `readAdvisorPublicMediaBuffer`: R2 read **5s timeout**, max bytes guard.
- `consentGetBuffer`: stream read timeout + max size.
- `advisorOgCardBuilder.js`: 단계 timing (`ADVISOR_OG_TIMING_LOG=1`), render timeout, photo fallback.
- `renderAdvisorMobileCardOgImage.js`: photo metadata 검증, corrupt/small → default silhouette, `position: 'top'`, JPEG normalize 후 composite.

## Deploy

- **SHA:** `699ed58e` (develop → Railway Dev)

## QA (2026-03-21)

```bash
node scripts/qa/validate-mobile-card-polish-round2.mjs
EXPECT_GIT_SHA=699ed58e node scripts/qa/validate-mobile-card-final-dev-integration.mjs
```

- 공개: `devThemeBarAbsent`, `heroTopPx: 0`
- OG: classic ~840ms, brand ~1515ms, premium ~653ms (1200×630 PNG)
- 연락처 PATCH 200, reload·공개 tel/mailto/url 확인

Kakao: [Sharing Debugger](https://developers.kakao.com/tool/debugger/sharing)에서 `/fc/qa-public-advisor-dev` 재수집 (OG 정상화 후).
