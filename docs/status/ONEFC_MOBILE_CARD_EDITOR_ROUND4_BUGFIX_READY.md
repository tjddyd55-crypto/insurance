# ONEFC_MOBILE_CARD_EDITOR_ROUND4_BUGFIX_READY

Development (`develop`) only. Production `main` unchanged.

## Summary

- Hero/호칭 입력: **value(저장값)** vs **placeholder(안내)** vs **preview fallback** 분리 (`null` = fallback, `''` = 비노출)
- DB: hero 3필드 + `title_label` nullable, legacy 빈 문자열 → `NULL` 마이그레이션
- Brand: FC 페이지에서 **원형 photo ring** 레이아웃 복원
- Premium: Hero media **2/3** 비율·높이 상향, 패널 하단 정렬
- 명함: FC 섹션 padding 축소, tile/img full-width
- 공유/QR/링크 복사: `buildAdvisorPublicPath(slug)` 기반 **canonical URL** SSOT
