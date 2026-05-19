# Government-support CRM 개발 진행 기록

> 계획 문서(로컬, Git 미추적): `dev/government_support_crm_composer25_step_plan.md`  
> 브랜치: `develop`  
> push 정책: 단계별 **commit만**, push는 별도 지시 시

---

## 0단계 — 기존 구조 분석 (완료)

**일자:** 2026-05-19  
**산출:** 코드 변경 없음, 구조 분석만 수행.

### 핵심 결론

| 항목 | 상태 |
|------|------|
| `/government/*` 전용 라우트 | **없음** (2단계에서 추가) |
| `/signup/government` | **있음** (`RegisterPage`, `appRouter`) |
| government-support 제품 형태 | **코드형 전용 CRM** (동적 빌더 아님) |
| 정적 government 템플릿 | `governmentCustomerTemplateV01.ts` (런타임 스키마, 별도 모듈과 병행 검토) |
| API envelope | `safeApiResponse`가 `{ success, data }` → **`data`만 반환** — unwrap 이중 조회 금지 |

### 라우팅 SSOT

- `src/appRouter.tsx`, `ProtectedRoute`, `SuperAdminRoute`, `AppWorkspaceLayout`
- 보험 CRM: `/customers` + `CustomerWorkspaceLayout` + `CustomersPage.tsx` (**회귀 위험 대**)

### 재사용 대상

- **인증/가입:** `RegisterPage`, `tenantRegistrationCodes.js`, `registerAuthAccountSmsApi.js`
- **플랫폼/테넌트:** `registerPlatformAdminApi.js`, `platformRbac.js`, `usePlatformAccess`
- **전자문서:** `features/contracts/*`, `contract*Api.js`
- **PDF:** `features/pdf-engine/*`, `registerPdfTemplateApi.js`
- **파일/R2:** `customerExtraApi.js`, `FileUploader`, `r2KeyPolicy.js`
- **일정:** `features/todos/*` (`/todos`)

### 위험 파일 (직접 대규모 수정 금지)

`CustomersPage.tsx`, `CustomerWorkspaceLayout.tsx`, `appRouter.tsx`(최소 diff), `server/index.js`, `initDb.js`, `registerPlatformAdminApi.js`, `platformRbac.js`, `safeApiResponse.ts`, `apiClient.ts`

### 1~11단계 로드맵 (계획 문서 기준)

| 단계 | 주제 | 상태 |
|------|------|------|
| 0 | 구조 분석 | ✅ 완료 |
| 1 | 권한 구조 | ⏳ 대기 |
| 2 | `/government/*` 라우트 | ⏳ |
| 3 | 대행사 + agencyCode 가입 | ⏳ |
| 4 | workspace 레이아웃 | ⏳ |
| 5 | 접수/고객/사업장 폼 | ⏳ |
| 6 | 자금/기대출/수임 | ⏳ |
| 7 | 신청/청약 건 | ⏳ |
| 8 | 전자문서 연결 | ⏳ |
| 9 | PDF 좌표 매핑 | ⏳ |
| 10 | 서류/파일/일정 | ⏳ |
| 11 | 최종 검증 | ⏳ |

---

## 1단계 — 권한 구조

_(진행 시 업데이트)_
