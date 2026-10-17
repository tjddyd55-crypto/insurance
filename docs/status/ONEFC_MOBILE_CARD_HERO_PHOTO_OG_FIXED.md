# ONEFC_MOBILE_CARD_HERO_PHOTO_OG_FIXED

Development only. Production/main unchanged.

## Policy

- `og:image` = 대표 Hero 사진 중심 1200×630 (blur 배경 + contain 인물 전경)
- 이미지 내 텍스트·테마 카드 UI 없음 (Classic/Brand/Premium 동일)
- `og:title` / `og:description`은 HTML meta 유지
- 캐시 무효화: `/api/public/advisors/:slug/og-card.png?v={profile.updatedAt ms}`

## Dev verification (post-deploy)

1. `https://insurance-dev.up.railway.app/fc/tjddyd55` HTML → `og:image`에 `?v=` 확인
2. `og:image` URL 직접 열기 → PNG 1200×630, 카드 UI 없음
3. Kakao Sharing Debugger 재수집
4. 새 대화방에서 공유 테스트

## Tests

```bash
node --test server/public-advisor-profile/renderAdvisorMobileCardOgImage.test.js server/public-advisor-profile/publicAdvisorOgMeta.test.js
```
