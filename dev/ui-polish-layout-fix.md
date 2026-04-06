# UI POLISH (레이아웃 + UX 개선)

원수사 소식지 · 고객 목록 화면 중심으로 정보 밀도와 모바일 탭 영역을 다듬은 작업입니다.

## 1. 뒤로가기 버튼

- **크기**: 44px → 32px (`page-back-btn`), 모서리 8px.
- **인라인 헤더**: `PageBackButton`에 `inline` prop 추가 → `page-back-btn--inline`으로 absolute 해제, 헤더 `page-header__title-row`와 한 줄 정렬.
- **레이아웃**: `.page--with-back .page-header.page-header--has-inline-back`에서 기존 좌측 패딩 보정 제거.

적용 페이지 예: `InsurerManagerNewsListPage` — 제목과 동일 헤더 블록에 `<PageBackButton inline />`.

## 2. 원수사 소식지 카드 (A4 비율 + 오버레이)

- **비율**: `.news-card__media`에 `aspect-ratio: 1 / 1.414`.
- **이미지**: `height: 100%`, `object-fit: cover`, 카드·미디어 `border-radius: 12px`.
- **오버레이**: 하단 `linear-gradient(to top, rgba(0,0,0,0.7), transparent)`.
- **표시 데이터**: 보험사명(`insurerName`), 게시일(`publishedAt` → `YYYY-MM-DD`).

구현: `NewsCard.tsx`, `insurer-news.css`.

## 3. 고객 리스트 UX

- **1행**: 이름 · 성별 · 보험나이 (`customer-expand-summary__row--primary`).
- **2행**: 상령일 · 상담일 (`customer-expand-summary__row--secondary`, 상담일은 기존 `recentConsultText`/`lastConsultDateLabel` 흐름).
- **펼침 표시**: 텍스트 "펼치기/접기" 대신 **▼ / ▲** (`aria-hidden`, `aria-expanded`는 버튼에 유지).
- **정렬**: 요약 행 `align-items: flex-start`, 힌트는 우측 고정.

구현: `CustomersPage.tsx` — `CustomerListCard`, `index.css` (`.customers-page .customer-expand-summary*`).

## 4. 카드 간격

- 고객 목록: `.customers-page ul.customer-list.record-list` **gap: 8px** (`space-y-2`에 해당), 카드 **margin-bottom: 0**으로 이중 여백 제거.

## 5. 향후 권장 (선택)

- 카드 **전체 행**이 이미 `<button class="customer-expand-summary">`로 탭 가능. 선택 모드에서는 체크박스에 `stopPropagation` 유지.

## 적용 순서 (개발 시)

1. `PageBackButton` + `index.css` (뒤로가기 + 헤더 패딩).
2. 소식지 카드 CSS/컴포넌트.
3. 고객 요약 TSX + `.customers-page` 스타일.
