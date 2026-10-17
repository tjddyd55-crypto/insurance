# ONEFC_MOBILE_CARD_ROUND6_THUMBNAIL_CONTACT_COPY_READY

Development (`develop`) only.

## 변경 요약

| 영역 | 내용 |
|------|------|
| OG `og:image` | 대표사진 중심 1200×630, 하단 최소 텍스트, verification 미노출 |
| 전화/팩스 | `formatKrPhoneNumberForDisplay` — 편집·Preview·공개 동일 |
| 추가정보 | UI 문구 `추가정보 입력` / `+ 추가정보 추가` |
| 연락처 row | 복사 아이콘 (`AdvisorPublicCopyButton`) |
| Hero | `ONE FC 확인` 등 verification 라인 UI 제거 |

## QA

```bash
node --test src/features/public-advisor/utils/formatKrPhoneNumber.test.ts
node --test server/public-advisor-profile/renderAdvisorMobileCardOgImage.test.js
node scripts/qa/capture-mobile-card-round6.mjs
```
