# 고객관리 DOM / className 구조 분석

## 간단한 아키텍처 개요
- 이 문서는 `CustomersPage` 기준의 실제 JSX 렌더 구조(=DOM 구조)와 className을 코드 기반으로 정리한다.
- 목적은 UI 보정 전에 실제 적용 타겟(class selector)을 오탐 없이 확정하는 것이다.
- 기능/API/DB/라우팅 변경 없이 분석만 수행했다.
- PC/모바일 분기 지점은 `useIsMobile` 체인을 따라 루트 레이아웃부터 고객 페이지까지 추적했다.

---

## 1) 고객 카드 구조

### 1-1. 고객 리스트 루트
- 리스트 컨테이너:
  - `record-list customer-expand-list customer-list customers-page__customer-list`
- 카드 루트(`li`):
  - 기본: `record-card customer-card customer-expand-card transition-all duration-200 ease-out`
  - 선택모드: `customer-expand-card--select-mode` 추가
  - 펼침(포커스): `customer-expand-card--focal` 추가

### 1-2. 카드 헤더(이름/나이/메타)
- 헤더 루트:
  - `customer-expand-summary` (+ 토글 가능 시 `customer-expand-summary--toggle transition-transform duration-150 ease-out active:scale-[0.98]`)
- 헤더 본문:
  - `customer-expand-summary__content w-full min-w-0`
- 이름/보조정보:
  - `customer-card-text-name flex flex-wrap items-center gap-x-2 gap-y-1`
  - `customer-card-name-primary font-semibold` (중복 하이라이트 시 `customer-name-ssn-dup` 추가)
  - 보조 텍스트: `text-sm text-[var(--text-secondary)] font-normal`
- 메타 줄:
  - `text-sm text-[var(--text-secondary)] customer-card-summary-meta mt-0.5`

### 1-3. 우측 액션 영역(별/문자/전화/펼침 화살표)
- 액션 wrapper:
  - `customer-card__actions`
- 아이콘 박스:
  - 각 아이콘 공통 wrapper: `icon-box`
- 즐겨찾기(별):
  - 버튼 class: `text-lg leading-none disabled:opacity-50`
  - 실제 버튼은 `FormButton -> Button`을 거치므로 기본 `button` 클래스가 함께 렌더됨
- 문자:
  - 링크 class: `text-lg text-blue-500 leading-none` (없으면 `text-lg opacity-35 grayscale` span)
- 전화:
  - 링크 class: `group transition-opacity hover:opacity-90 active:opacity-80`
- 펼침 화살표:
  - `customer-expand-summary__hint`

### 1-4. 펼침 영역 루트
- 상세 루트:
  - `customer-expand-detail`
  - 닫힘 트랜지션 중: `customer-expand-detail--closing` 추가

### 1-5. 펼침 내부 액션(복사/수정/삭제)
- 툴바:
  - `customer-detail-toolbar`
- 내부 액션 그룹:
  - `customer-card-icon-actions`
- 버튼 3종:
  - 공통 class: `customer-icon-action`
  - 복사(📋) / 수정(✏️, 조건부) / 삭제(🗑)
  - 실제 버튼은 기본 `button` 클래스 동시 렌더

### 1-6. 실제 HTML 구조(요약)
```html
<ul class="record-list customer-expand-list customer-list customers-page__customer-list">
  <li class="record-card customer-card customer-expand-card ...">
    <div class="customer-expand-card__main">
      <div class="customer-expand-summary ...">
        <span class="customer-expand-summary__content w-full min-w-0">
          <div class="flex justify-between items-center gap-2 w-full min-w-0">
            <div class="min-w-0 flex-1">
              <div class="customer-card-text-name flex flex-wrap items-center gap-x-2 gap-y-1">
                <span class="customer-card-name-primary font-semibold ...">이름</span>
              </div>
              <div class="text-sm text-[var(--text-secondary)] customer-card-summary-meta mt-0.5">메타</div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <div class="customer-card__actions">
                <div class="icon-box"><button class="button text-lg leading-none ...">★</button></div>
                <div class="icon-box"><a class="text-lg text-blue-500 leading-none">💬</a></div>
                <div class="icon-box"><a class="group transition-opacity hover:opacity-90 active:opacity-80">📞</a></div>
              </div>
              <span class="customer-expand-summary__hint">▼</span>
            </div>
          </div>
        </span>
      </div>

      <div class="customer-expand-detail ...">
        <div class="customer-detail-toolbar">
          <div>고객명</div>
          <div class="customer-card-icon-actions">
            <button class="button customer-icon-action">📋</button>
            <button class="button customer-icon-action">✏️</button>
            <button class="button customer-icon-action">🗑</button>
          </div>
        </div>
      </div>
    </div>
  </li>
</ul>
```

---

## 2) 상단 영역 구조

### 2-1. 상단 버튼 행
- 헤더:
  - `page-header customers-page__header`
- 버튼 행:
  - `customers-page__action-row`
- 버튼별 class:
  - 고객 등록: `cta-button customers-page__action-btn`
  - 등록 링크(div): `cta-button customers-page__action-btn customers-page__invite-copy-btn`
  - 엑셀 다운로드: `cta-button customers-page__action-btn`

### 2-2. 검색/필터 행
- 행 루트:
  - `customers-page__search-row`
- 검색 input:
  - `search-input customers-page__search-input`
  - `FormInput` 공통 클래스가 추가되어 실제 입력 DOM에는 `form-input` 계열 클래스가 함께 붙음
- 중요 고객 버튼:
  - `px-3 py-2 rounded-lg border text-sm shrink-0 transition-colors ...`
  - 실제 버튼은 기본 `button` 클래스 동시 렌더
- 필터 버튼:
  - 기본: `customers-page__filter-toggle`
  - 활성: `customers-page__filter-toggle customers-page__filter-toggle--on`
  - 실제 버튼은 기본 `button` 클래스 동시 렌더

### 2-3. 실제 HTML 구조(요약)
```html
<header class="page-header customers-page__header">
  <div class="customers-page__action-row">
    <button class="button cta-button customers-page__action-btn">고객 등록</button>
    <div class="cta-button customers-page__action-btn customers-page__invite-copy-btn" role="button">등록 링크</div>
    <button class="button cta-button customers-page__action-btn">엑셀 다운로드</button>
  </div>

  <div class="customers-page__search-row">
    <input class="form-input field--editable search-input customers-page__search-input" type="search" />
    <button class="button px-3 py-2 rounded-lg border text-sm shrink-0 transition-colors ...">중요 고객</button>
    <button class="button customers-page__filter-toggle ...">필터</button>
  </div>
</header>
```

---

## 3) 액션 버튼 구조 + CSS 적용 여부

## 3-1. 카드 액션 관련 클래스
- 구조 클래스:
  - `customer-card__actions`
  - `icon-box`
  - `customer-expand-summary__hint`
  - `customer-detail-toolbar`
  - `customer-card-icon-actions`
  - `customer-icon-action`

### 3-2. `index.css`에 존재하는 selector 확인
- 존재:
  - `.customer-expand-list`
  - `.customer-expand-card`
  - `.customer-icon-action`
  - `.customers-page__action-row`
  - `button.cta-button.customers-page__action-btn`
  - `div.cta-button.customers-page__action-btn[role='button']`
  - `.customers-page__search-row`
  - `.customers-page__search-input`
  - `.customers-page__filter-toggle`
  - `.customers-page .customer-expand-summary`
  - `.customers-page .customer-card-name-primary`
  - `.customers-page .customer-card-summary-meta`
  - `.customers-page .customer-card__actions`
  - `.customers-page .customer-card__actions .icon-box`
  - `.customers-page .customer-expand-detail`
  - `.customers-page__invite-copy-btn`
- 모바일 스코프로만 존재:
  - `.mobile-root .customers-page .customer-detail-toolbar`
  - `.mobile-root .customers-page .customer-card-icon-actions`

### 3-3. 공통 컴포넌트가 추가하는 실제 클래스
- `FormButton`은 내부에서 `Button`을 사용하고, `Button`은 항상 기본 클래스 `button`을 추가
- `FormInput`은 기본적으로 `form-input` + 상태 클래스(`field--editable`/`field--readonly`)를 추가

---

## 4) PC / 모바일 분기 위치

### 4-1. 최상위 분기
- `AppWorkspaceLayout`:
  - `ResponsiveLayout PC={PCLayout} Mobile={MobileLayout}`
- `ResponsiveLayout`:
  - `const isMobile = useIsMobile()`
  - `return isMobile ? <Mobile /> : <PC />`

### 4-2. 루트 class 분리
- 모바일 레이아웃 루트:
  - `mobile-root mobile-workspace-layout`
- PC 레이아웃 루트:
  - `pc-root app-workspace-layout-root`

### 4-3. 고객관리 영역 분기
- `CustomersPage`:
  - `const isMobile = useIsMobile()`
  - 모바일 전용 블록 렌더:
    - `customer-detail-feature-actions`
    - `customer-detail-feature-actions--mobile`
  - 엑셀 다운로드 클릭 시 모바일에서는 경고 후 종료
- `CustomerWorkspaceLayout`:
  - `const isMobile = useIsMobile()`
  - `!isMobile`일 때만 우측 작업영역(`customer-workspace-layout__right`) 렌더

---

## 핵심 결정 설명
- 왜 이 구조로 정리했는가:
  - 실제 JSX 기준의 렌더 className과 CSS selector 존재 여부를 1:1로 맞춰야 오탐 없이 UI 보정 가능하기 때문이다.
- 이후 변경은 어디서 하면 되는가:
  - 구조 변경은 `CustomersPage.tsx`
  - 스타일 적용은 `index.css`에서 해당 클래스 selector 블록
  - PC/모바일 분기는 `AppWorkspaceLayout.tsx` + `ResponsiveLayout.tsx` + 각 페이지 `useIsMobile()`
- 의도적으로 엄격/유연한 부분:
  - 엄격: 존재 확인된 className/selector만 기록(추측 배제)
  - 유연: 공통 컴포넌트(`FormButton`, `FormInput`)에서 자동 추가되는 클래스까지 함께 명시해 실제 DOM 기준 분석 가능하게 함

