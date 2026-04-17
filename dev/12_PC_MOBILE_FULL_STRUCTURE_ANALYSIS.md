# 전체 구조 분석 FULL (PC/모바일 완전 분리 준비)

목적: **현재 구조를 완전히 이해하고, 어디를 쪼개야 할지 정확히 잡기 위한 분석**

분석 기준:

- 코드 수정 없이 현행 구조만 분석
- 고객 워크스페이스 중심(`/customers`*, `/customer/*`)
- PC/모바일 분기, 상태 소유권, 의존 관계, 분리 리스크 식별

---

## 1) 라우팅 구조 전체 분석

기준 파일: `src/appRouter.tsx`, `src/layouts/AppWorkspaceLayout.tsx`, `src/features/customers/pages/CustomerWorkspaceLayout.tsx`, `src/features/customers/pages/CustomersPage.tsx`

### 1-1. 고객 라우팅 트리 (실제 매칭 기준)

```text
/
└─ AppLayout
   └─ ProtectedRoute
      └─ AppWorkspaceLayout (ResponsiveLayout로 PC/Mobile Shell 분기)
         ├─ /customers
         │  └─ CustomerWorkspaceLayout
         │     ├─ (index) CustomerWorkspaceHomePage
         │     ├─ :customerId/files         -> CustomerFilesPage
         │     ├─ :customerId/consultations -> CustomerConsultationsPage
         │     ├─ :customerId/ga-excel      -> CustomerGaExcelPage
         │     └─ :customerId/memos         -> CustomerMemosPage
         ├─ /customer/:customerId/files    -> CustomerFilesPage (모바일 직접 경로)
         ├─ /customer/:customerId/consults -> CustomerConsultationsPage (모바일 직접 경로)
         ├─ /customer/:customerId/auto     -> CustomerAutoPage
         ├─ /customer/:customerId/ga       -> CustomerGaExcelPage
         └─ /customer/:customerId/memos    -> CustomerMemosPage
```

### 1-2. 요청 경로별 분석

#### `/customers`

- 렌더 컴포넌트
  - `CustomerWorkspaceLayout` (좌측 `CustomersPage`, 우측 패널은 PC에서만)
  - index child가 `CustomerWorkspaceHomePage`
- 레이아웃 체인
  - `AppLayout` -> `ProtectedRoute` -> `AppWorkspaceLayout(PC/Mobile)` -> `CustomerWorkspaceLayout`
- PC/모바일 분기 지점
  - 1차: `AppWorkspaceLayout`에서 PC/Mobile shell 완전 분리
  - 2차: `CustomerWorkspaceLayout` 내부에서 `!isMobile`일 때만 우측 패널 렌더
- navigate 흐름
  - 고객 클릭 시(PC) `CustomersPage.handleSelectCustomer`에서 `/customers/:id/:safeTab`으로 이동
  - 고객 클릭 시(모바일) expand 유지, 실제 기능 이동은 `/customer/:id/*`로 분기

#### `/customers/:id`

- **현재 라우터에 직접 정의된 child가 없음**
- 결과
  - `customers` 하위에서 `:customerId` 단독 경로 미매칭
  - 실질적으로는 `/customers/:id/files|consultations|ga-excel|memos`를 사용해야 함
- 영향
  - 외부 링크/북마크에서 `/customers/:id`를 사용하면 의도한 화면 진입이 깨질 수 있음

#### `/customers/:id/files`

- 렌더 컴포넌트
  - `CustomerWorkspaceLayout`의 `<Outlet />` child로 `CustomerFilesPage`
- 레이아웃 체인
  - `AppLayout` -> `ProtectedRoute` -> `AppWorkspaceLayout` -> `CustomerWorkspaceLayout` -> `CustomerFilesPage`
- PC/모바일 분기
  - `CustomerWorkspaceLayout`: PC 우측 패널에서 child 렌더
  - 모바일은 보통 `/customer/:id/files` 직접 경로 사용
  - `CustomerFilesPage` 내부에서 `isMobile`로 모바일 고객 선택 헤더/탭 구성
- navigate 흐름
  - PC 상단 버튼 `"고객 파일"` -> `moveTo(/customers/:id/files)`
  - 모바일 카드 버튼 `"고객 파일"` -> `/customer/:id/files`

#### `/customers/:id/consultations`

- 렌더 컴포넌트
  - `CustomerConsultationsPage`
- 레이아웃 체인
  - `AppLayout` -> `ProtectedRoute` -> `AppWorkspaceLayout` -> `CustomerWorkspaceLayout` -> `CustomerConsultationsPage`
- PC/모바일 분기
  - `CustomerConsultationsPage`에서 `!isMobile`일 때만 항목별 삭제 버튼 노출
- navigate 흐름
  - PC 상단 버튼 `"상담 이력"` -> `moveTo(/customers/:id/consultations)`
  - 모바일 카드 버튼 `"상담 내역"` -> `/customer/:id/consults`

#### `/customers/:id/ga-excel`

- 렌더 컴포넌트
  - `CustomerGaExcelPage`
- 레이아웃 체인
  - `AppLayout` -> `ProtectedRoute` -> `AppWorkspaceLayout` -> `CustomerWorkspaceLayout` -> `CustomerGaExcelPage`
- PC/모바일 분기
  - `CustomerWorkspaceLayout`에서 기능 사용 가능(`excelCap`)일 때 탭 버튼 노출
  - `CustomerGaExcelPage`는 `isMobile`로 container width만 조정
- navigate 흐름
  - PC 상단 버튼 `"GA 고객 데이터 보기"` -> `moveTo(/customers/:id/ga-excel)`
  - 모바일 카드 버튼 `"GA 데이터 보기"` -> `/customer/:id/ga`

---

## 2) isMobile / 반응형 분기 위치 전수 조사

검색 키워드: `useIsMobile`, `isMobile`, `window.innerWidth`

### 2-1. 현재 분기 위치 지도 (파일별)

#### Hook/공통

- `src/hooks/useIsMobile.ts`
  - 방식: 훅 내부 viewport 판단 (`matchMedia('(max-width: 768px)')`) + resize 구독
  - 역할: 전역 모바일 기준 단일화
- `src/components/ResponsiveLayout.tsx`
  - 방식: 렌더 분기
  - 분리 UI: `PC` 컴포넌트 vs `Mobile` 컴포넌트

#### 전역 레이아웃

- `src/AppLayout.tsx`
  - 방식: 조건 렌더
  - 분리 UI: 비로그인 + 모바일 로그인일 때 상단 크롬 숨김
- `src/layouts/AppWorkspaceLayout.tsx`
  - 방식: `ResponsiveLayout`로 shell 분리 + 모바일 topbar 조건 렌더
  - 분리 UI: PC 전체 셸(사이드바/메모 패널) vs 모바일 셸(drawer/topbar)
- `src/layouts/MainWorkspaceLayout.tsx`
  - 방식: 렌더 분기 + class 분기
  - 분리 UI: 메모 리스트/패널 배치와 모바일 뷰 처리

#### 고객 도메인

- `src/features/customers/pages/CustomerWorkspaceLayout.tsx`
  - 방식: 렌더 분기 + effect 분기
  - 분리 UI: PC 우측 워크스페이스 패널 on/off, 모바일 시 label/excelCap 처리 중단
- `src/features/customers/pages/CustomersPage.tsx`
  - 방식: 조건문/네비 분기/상태 복원 분기
  - 분리 UI: 모바일 expand/scroll 복원, PC 고객 선택 시 우측 탭 라우팅
- `src/features/customers/pages/CustomerFilesPage.tsx`
  - 방식: 조건 렌더
  - 분리 UI: 모바일 고객 선택 모달+탭 헤더 (`headerSlot`)
- `src/features/customers/pages/CustomerConsultationsPage.tsx`
  - 방식: 조건 렌더
  - 분리 UI: PC만 상담 삭제 버튼 노출
- `src/features/customers/pages/CustomerGaExcelPage.tsx`
  - 방식: 스타일 분기
  - 분리 UI: 모바일/PC 컨테이너 폭

#### 기타 기능

- `src/features/auth/pages/LoginPage.tsx`
  - 방식: 렌더/클래스 분기
  - 분리 UI: 모바일 로그인 단일 컬럼 vs PC split 레이아웃
- `src/features/auth/pages/ProfilePage.tsx`
  - 방식: 조건 렌더
  - 분리 UI: 엑셀/GA 업로드 섹션 PC only, 모바일 안내 박스
- `src/features/insurer-news/components/NewsCard.tsx`
  - 방식: 렌더 분기
  - 분리 UI: 모바일 카드 구조/이미지 클래스 vs PC media wrapper
- `src/features/insurer-news/pages/InsurerManagerNewsListPage.tsx`
  - 방식: 네비 분기 + 모달 렌더 분기
  - 분리 UI: 모바일 카드 클릭 시 상세 페이지 이동, PC는 모달

#### Prop으로 전달받아 분기하는 컴포넌트

- `src/features/storage/components/StorageToolbar.tsx`
  - 방식: props 기반 렌더 분기
  - 분리 UI: 업로드 UI 배치(PC inline vs 모바일 full-row)
- `src/features/storage/components/FolderPicker.tsx`
  - 방식: props 기반 렌더 분기
  - 분리 UI: PC select vs 모바일 모달
- `src/features/memo/components/MemoElectronFabDock.tsx`
  - 방식: props 기반 렌더 분기
  - 분리 UI: 모바일에서는 fullscreen/minimize 메뉴 숨김

### 2-2. `window.innerWidth` 조사 결과

- 직접 사용: 없음 (0건)
- viewport 판별은 `useIsMobile` 훅 내부로 수렴됨

---

## 3) 레이아웃 구조 분석 (핵심)

대상: `AppLayout`, `CustomerWorkspaceLayout`, `CustomersPage`

### 3-1. `AppLayout` (`src/AppLayout.tsx`)

- 역할
  - 앱 루트 크롬(타이틀바/배너/글로벌 back handler)과 `GaSettingsProvider` 제공
- 감싸는 대상
  - 라우터 `<Outlet />` 전체
- 상태 관리
  - 로컬 상태는 거의 없고 auth/location 기반 계산
- PC/모바일 분기
  - 있음 (`hideMobileLoginTopChrome`)
- 분리 기준점 추천
  - **유지**: 전역 루트로 그대로 두고, 페이지별 분리를 여기서 시작하지 말 것

### 3-2. `CustomerWorkspaceLayout` (`src/features/customers/pages/CustomerWorkspaceLayout.tsx`)

- 역할
  - 고객 영역 2패널 orchestration(좌측 목록 + PC 우측 작업영역)
  - selectedCustomerId, tab, excel capability, rightPanelCarForm 제어
- 감싸는 대상
  - 좌측 `CustomersPage`
  - 우측 child route (`CustomerFilesPage`/`CustomerConsultationsPage`/`CustomerGaExcelPage`/`CustomerMemosPage`)
- 상태 관리
  - `selectedCustomerLabel`, `excelCap`, `rightPanelCarForm` 등 핵심 orchestration 상태 소유
- PC/모바일 분기
  - 큼: 모바일에서는 우측 패널 자체 렌더하지 않음
- 분리 기준점 추천
  - **1차 분리 최적 지점**: `CustomerWorkspaceLayoutPC` / `CustomerWorkspaceLayoutMobile`
  - 단, `selectedCustomerId` 계산 로직은 공통 유틸로 분리 후 재사용

### 3-3. `CustomersPage` (`src/features/customers/pages/CustomersPage.tsx`)

- 역할
  - 고객 목록/검색/필터/정렬/카드 확장/수정/삭제/내부 이동의 허브
- 감싸는 대상
  - `CustomerListCard` 반복 렌더 + create/list 모드 전환
- 상태 관리
  - 고객 도메인 상태 대부분을 직접 소유 (`customers`, `expandedId`, `editingId`, 필터, 선택모드 등)
- PC/모바일 분기
  - 큼: 모바일 UI 복원(scroll/expanded) 및 기능 이동 경로(`/customer/`*) 분리
- 분리 기준점 추천
  - **2차 분리 대상**: `CustomersPage`를 컨테이너/뷰로 나누고, 뷰를 `CustomersPagePCView`/`CustomersPageMobileView`로 분리
  - 현재는 상태가 매우 집중되어 있어 한 번에 분리하면 리스크 큼

---

## 4) 상태 관리 위치 분석 (매우 중요)

### 4-1. `selectedCustomerId`

- 선언 위치
  - `src/features/customers/pages/CustomerWorkspaceLayout.tsx`
- 방식
  - `useMemo` (path + query 파싱 결과)
- 전달 범위
  - 우측 child route로 `Outlet context`
  - 상단 탭 버튼 비활성/이동 제어
- 판단
  - **건드리면 안됨(핵심 축)**: 워크스페이스 선택 동기화의 기준점

### 4-2. `currentTab` (files/consultations/ga/memos)

- 선언 위치
  - `currentPathTab`: `CustomerWorkspaceLayout`의 `useMemo(resolveWorkspacePathTab(location.pathname))`
  - `safeTab`: `currentPathTab ?? 'files'`
  - `activeTab`: `rightPanelCarForm` 포함한 최종 UI 탭
- 방식
  - 경로 기반 계산 + 로컬 상태 조합
- 전달 범위
  - 상단 액션 버튼 active 표시
  - 고객 변경 시 이동 경로 보정(`/customers/:id/:safeTab`)
- 판단
  - **건드리면 안됨(핵심 축)**: 탭 경로 유지/active 표시/고객 변경 동기화 결합점

### 4-3. 고객 리스트 상태

- 선언 위치
  - `src/features/customers/pages/CustomersPage.tsx`
  - `const [customers, setCustomers] = useState<CustomerRecord[]>([])`
- 방식
  - 로컬 `useState` + `loadCustomers()`에서 API fetch
- 전달 범위
  - `CustomerListCard` props로 하향 전달
  - 필터/정렬/선택/즐겨찾기/메모 반영까지 동일 state를 기준으로 파생
- 판단
  - **분리 가능(주의 필요)**: 컨테이너(state)와 프레젠테이션 뷰 분리 가능
  - 단, 현재 파생 state/side effect가 많아 단계적 분리 필요

### 4-4. 파일/상담/GA 데이터 상태

- 파일
  - 파일 상태 소유: `src/features/storage/components/StorageWorkspace.tsx`
  - 주요 state: `folders`, `files`, `selectedFolderId`, `quota`, `error` 등
  - `CustomerFilesPage`는 container 역할(고객 선택/헤더 제공)만 수행
- 상담
  - 상태 소유: `src/features/customers/pages/CustomerConsultationsPage.tsx`
  - 주요 state: `rows`, `body`, `consultDate`, `busy`, `notFound`
- GA 엑셀
  - 상태 소유: `src/features/customers/pages/CustomerGaExcelPage.tsx`
  - 주요 state: `headers`, `colIds`, `rows`, `sortIdx`, `sortAsc`, `loading`
- 판단
  - **분리 가능(상대적으로 안전)**: 각 페이지가 이미 독립 데이터 경계를 가짐

---

## 5) 컴포넌트 의존 관계 (핵심)

대상: `CustomersPage`, `CustomerWorkspaceLayout`, `CustomerFilesPage`, `CustomerConsultationsPage`, `CustomerGaExcelPage`

### 5-1. import/렌더 트리

```text
appRouter
└─ CustomerWorkspaceLayout
   ├─ imports -> CustomersPage
   ├─ renders left -> CustomersPage
   └─ renders right -> Outlet
      ├─ CustomerFilesPage
      ├─ CustomerConsultationsPage
      └─ CustomerGaExcelPage
```

별도 모바일 직행 라우트:

```text
appRouter
├─ /customer/:id/files    -> CustomerFilesPage
├─ /customer/:id/consults -> CustomerConsultationsPage
└─ /customer/:id/ga       -> CustomerGaExcelPage
```

### 5-2. 데이터 fetch 위치

- `CustomersPage`
  - `listCustomers`, `searchCustomersAdvanced`, `fetchConsultationCounts`, `listCustomerConsultations(최근일 계산)`
- `CustomerWorkspaceLayout`
  - `getCustomerById`(selected label), `fetchGaCustomerExcelCapability`
- `CustomerFilesPage`
  - 모바일 고객 picker용 `listCustomers`
  - 실제 파일 데이터는 `StorageWorkspace` 내부 fetch
- `CustomerConsultationsPage`
  - `listCustomerConsultations`, `createCustomerConsultation`, `deleteCustomerConsultation`
- `CustomerGaExcelPage`
  - `fetchCustomerGaExcelData`

### 5-3. 상태 의존 관계

- 강결합
  - `CustomerWorkspaceLayout.selectedCustomerId` <-> 상단 탭 버튼/우측 Outlet
  - `CustomersPage`의 선택/확장 상태 <-> 모바일 back 복원/네비 state 전달
- 약결합
  - 상세 페이지들(`Files/Consultations/GaExcel`)은 route param 중심으로 독립 동작

### 5-4. 분리 시 영향 범위

- `CustomerWorkspaceLayout` 분리
  - 영향: 고객 선택 동기화, 탭 유지, 우측 패널 렌더 경계
  - 리스크: route/query 동기화 깨짐 가능성
- `CustomersPage` 분리
  - 영향: 카드 상호작용, 모바일 복원, 검색/정렬/선택모드 전부
  - 리스크: 가장 큼(상태 밀집)
- `CustomerFiles/Consultations/GaExcel` 분리
  - 영향: 로컬 UI/데이터 바운더리
  - 리스크: 상대적으로 낮음

---

## 6) 최종 결과

### [현재 구조 요약]

1. PC / 모바일 분기 위치
  - 1차 전역 분기: `AppWorkspaceLayout` + `ResponsiveLayout`
  - 2차 도메인 분기: `CustomerWorkspaceLayout`, `CustomersPage`, 각 상세 페이지 내부 조건 분기
2. 핵심 상태 관리 위치
  - 워크스페이스 선택/탭: `CustomerWorkspaceLayout`
  - 고객 목록/카드 상호작용: `CustomersPage`
  - 파일/상담/GA 데이터: 각 상세 페이지(또는 `StorageWorkspace`) 로컬 소유
3. 라우팅 흐름
  - PC 중심: `/customers/:id/:tab`
  - 모바일 중심: `/customer/:id/*` 직접 진입 + 카드 expand/scroll 복원

### [분리 전략 제안]

1. 1차 분리 대상 (가장 안전)
  - `CustomerWorkspaceLayout`를 PC/Mobile 컴포넌트로 분리
  - 공통 유틸: `selectedCustomerId`/`tab` 파싱 로직만 공유
2. 2차 분리 대상
  - `CustomersPage`를 컨테이너(상태) + PC/Mobile 뷰 컴포넌트로 분리
3. 절대 건드리면 안 되는 부분
  - `selectedCustomerId` 계산 규칙(path/query 우선순위)
  - `safeTab`/`activeTab` 기반 경로 유지 로직
  - 모바일 복원(`expandedCustomerId`, `scrollY`) 저장/복원 흐름
4. 분리 시 주의할 점
  - `/customers/*`와 `/customer/*` 이중 경로 체계를 동시에 유지해야 함
  - `CustomerWorkspaceLayout` <-> `CustomersPage` 간 네비/상태 계약을 먼저 인터페이스로 고정해야 함

### [위험 요소]

- 분리 시 깨질 가능성 높은 부분
  - 고객 변경 시 탭 유지(`/customers/:id/:safeTab`) 동기화
  - 모바일 뒤로가기 시 확장 카드/스크롤 복원
  - PC 우측 패널 조건 렌더(`selectedCustomerId ? Outlet : EmptyState`)
- 의존성이 강한 부분
  - `CustomersPage` (상태 집중도 최고)
  - `CustomerWorkspaceLayout` (선택/탭/액션 라우팅 허브)

---

## 부록: 요청 경로 유효성 체크

- `/customers` : 유효
- `/customers/:id` : **현재 직접 child route 없음(미정의)**
- `/customers/:id/files` : 유효
- `/customers/:id/consultations` : 유효
- `/customers/:id/ga-excel` : 유효

즉, `:id` 단독 경로를 사용하는 외부 링크가 있다면 `/customers/:id/files` 등으로 정규화 정책을 두는 것이 안전하다.