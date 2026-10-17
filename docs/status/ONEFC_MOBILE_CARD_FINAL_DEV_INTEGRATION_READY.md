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

## QA

```bash
node scripts/qa/validate-mobile-card-polish-round2.mjs
node scripts/qa/validate-mobile-card-final-dev-integration.mjs
```

Kakao: [Sharing Debugger](https://developers.kakao.com/tool/debugger/sharing)에서 `/fc/:slug` 재수집.
