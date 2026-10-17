# ONEFC_MOBILE_CARD_EDITOR_LIVE_PREVIEW_AND_UPLOAD_FIX_READY

Development (`develop`) only.

## Root causes (upload / broken preview)

1. **Mixed content:** `/api/me/public-profile`가 Railway reverse proxy에서 `req.protocol === 'http'`로 미디어 URL을 생성 → HTTPS 페이지에서 `<img src="http://...">` 차단.
   - Fix: `resolveRequestPublicOrigin()` + 클라이언트 `normalizeAdvisorMediaUrl()`.

2. **미발행 프로필 미디어 404:** `/api/public/advisor-media`가 `is_published = true`만 허용 → 편집 중(공개 OFF) 또는 저장 전 조회 시 404.
   - Fix: `assertAdvisorPublicMediaDeliverable()` — DB에 연결된 키(프로필·갤러리)도 허용.

3. **편집 UX:** 업로드 직후 서버 URL만 기대 → PATCH/GET 타이밍·캐시에 의존.
   - Fix: 업로드 성공 시 **blob URL**로 즉시 썸네일·Live Preview 반영, `저장` 시 objectKey PATCH.

## Features

- `AdvisorPublicProfileView` — 공개 `/fc/:slug`와 편집 Live Preview SSOT
- PC ≥1100px: 2-column + sticky 390px preview
- 명함 썸네일 `min(320px, 100%)`, `aspect-ratio: 90/50`
- 테마 선택 카드 compact (상세는 오른쪽 preview)
