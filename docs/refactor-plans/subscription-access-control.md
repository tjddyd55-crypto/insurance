# 구독 상태 기반 접근 제어 시스템 — 설계/구현 계획

> 상태: **초안(승인 대기)** — §0 의사결정 확정 후 §4 PR 분할대로 착수한다.
> 범위: FREE / TRIAL / PAID / EXPIRED 4단계 상태 모델을 도입하고,
> 서버·프론트 동일 정책으로 접근 제어한다. 실제 PG 결제 연동은 스코프 밖.

---

## 0. 확정 필요한 의사결정 5개

| # | 항목 | 권장안 | 대안 |
|---|------|--------|------|
| D1 | **구독 대상 역할** | `USER`, `GA_ADMIN`, `GA_STAFF` 만 구독 대상. `SUPER_ADMIN` 은 항상 FREE, `INSURER_MANAGER` / `LOSS_ADJUSTER` 는 이번 스코프 제외(별도 계정 체계). | 담당자도 포함 |
| D2 | **전 유저 기본값** | 전부 `FREE` 로 배포. 누구도 차단되지 않음 → 무중단 이행. 과금 시작 시 관리자가 TRIAL/PAID 로 전환. | 전 유저 TRIAL 부여 후 만료 시 EXPIRED |
| D3 | **구독 단위** | **유저별**. "GA 전체 일괄 30일 TRIAL" 같은 운영 요구는 관리자 **일괄 작업 기능**으로 커버. | GA 단위 구독 + 유저별 오버라이드 (복잡) |
| D4 | **관리자 UI** | 기존 `/admin/users`(`UserManagementPage`) 를 확장(플랜 컬럼·필터·일괄작업). | 신규 `/admin/subscriptions` 페이지 분리 |
| D5 | **PR 분할 & 머지 순서** | 아래 §4 의 6단계 PR. 각 PR 은 develop → main 순차 머지, 사용자 테스트 후 다음 PR. | 한 번에 big bang |

---

## 1. 현상 파악 (Why it matters)

탐색 결과 요약(출처: 탐색 에이전트 보고서, 2026-04-16 기준):

### 1-1. users 테이블
- `CREATE TABLE users`: `id / username / password_hash / created_at`
- 순차 `ALTER TABLE` 로 `role / display_name / ga_id / status / is_deleted / phone / team_id / storage_limit / storage_used` 추가
- `role` 정규화값: `SUPER_ADMIN | GA_ADMIN | GA_STAFF | USER | INSURER_MANAGER | LOSS_ADJUSTER`
- `status` CHECK: `active | blocked | inactive | reset` — **구독 상태가 아님** (계정 정지 상태)
- **구독/결제 관련 컬럼 전무**

### 1-2. 마이그레이션 패턴
- 별도 마이그레이션 도구 없음. `server/initDb.js` 가 idempotent 스크립트로 매 기동 수행.
- 관례: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, CHECK 제약은 `DROP ... IF EXISTS` 후 `ADD`, 인덱스는 `CREATE INDEX IF NOT EXISTS`.

### 1-3. 인증·인가
- `server/index.js` 에 `requireAuth` 존재. `req.user = { id, username, role, gaId, gaCode, gaName, companyId, displayName, teamId }`
- 로그인: `POST /api/auth/login` → `{ token, user }` (snake_case) → 프론트 `authApi.login()` 에서 camelCase 정규화
- 프로필: `GET /api/me` (`USER` 만 `requireProfileUser` 통과)
- 403 표준 응답: `forbiddenResponse(req, res, message)` → `{ error: 'FORBIDDEN', message }`
- **토큰 refresh 엔드포인트 없음.** 만료되면 요청 시 401.

### 1-4. 프론트 가드
- `ProtectedRoute`: 로그인 필수
- `SuperAdminRoute` / `StaffRoute` / `RequireNotInsurerManagerRoute` / `InsurerManagerOnlyRoute` / `GaCarInsuranceRoute` / `AuditLogReaderRoute`
- 공용 헬퍼: `src/features/auth/roleGuards.ts`

### 1-5. 라우트 / 메뉴
- `appRouter.tsx` 는 공개 → `ProtectedRoute` → `AppWorkspaceLayout` → (역할 가드) → 페이지 순으로 중첩
- 대시보드 메뉴 SSOT: `src/features/dashboard/gaTenantMenu.ts`
  - `buildGaTenantDashboardMenu` 가 일반 유저용 메뉴
  - `buildAppMenuForSession(role, …)` 가 역할별 메뉴 병합
- "내 정보 관리" = `/profile` (`ProfilePage`) — **이 한 경로가 EXPIRED 허용의 중심**
- "문의·요청" = `/feature-request` (`FeatureRequestPage`) — EXPIRED 허용 대상
- "내 저장공간" = `/storage` (`MyStoragePage`) — 업로드 기능 포함 → **EXPIRED 차단 대상**

### 1-6. 관리자 페이지
- 이미 `/admin/users` (`UserManagementPage`) 존재 → 여기에 플랜 컬럼/필터/일괄작업 확장이 자연스러움
- 관리자 라우트 프리픽스는 `/admin/...` 과 `/internal/admin/...` 혼재(기존 관례 유지)

---

## 2. 정책 SSOT 설계

### 2-1. 상태 모델

```
plan ∈ { FREE, TRIAL, PAID, EXPIRED }
expires_at ∈ TIMESTAMPTZ | NULL
started_at ∈ TIMESTAMPTZ | NULL
```

**원칙**: DB 의 `plan` 은 **"의도한 상태"** 고, **"실제 유효 상태"** 는 서버가 계산한다.

- `plan='FREE'`                                         → effective: `FREE`
- `plan='TRIAL' | 'PAID'` AND `expires_at > NOW()`      → effective: `TRIAL | PAID` (활성)
- `plan='TRIAL' | 'PAID'` AND `expires_at <= NOW()`     → effective: `EXPIRED`
- `plan='EXPIRED'` (관리자 강제)                         → effective: `EXPIRED`

=> cron 불필요. **매 요청 시 `evaluateSubscription()` 으로 판정**. DB 의 `plan` 을 뒤늦게 `EXPIRED` 로 업데이트하는 동기화는 선택(로그인 성공 시 lazy update).

### 2-2. 역할별 기본 정책

| role | 구독 대상 | 기본 plan | 만료 적용 |
|------|----------|-----------|-----------|
| `SUPER_ADMIN` | ❌ | (N/A) | 항상 통과 |
| `GA_ADMIN` / `GA_STAFF` / `USER` | ✅ | `FREE` | effective=EXPIRED 이면 차단 |
| `INSURER_MANAGER` / `LOSS_ADJUSTER` | ❌ (이번 스코프) | (N/A) | 항상 통과 (기존 로직 유지) |

### 2-3. 공용 정책 함수 (서버 = 프론트 시그니처 동일)

```
// 순수 함수 — I/O 없음, 테스트 가능
evaluateSubscription(input: {
  role: string
  plan: 'FREE'|'TRIAL'|'PAID'|'EXPIRED'|null
  expiresAt: Date|string|null
  startedAt: Date|string|null
  now?: Date                    // 테스트용 주입 가능
}): {
  effectiveStatus: 'ACTIVE'|'EXPIRED'
  plan: 'FREE'|'TRIAL'|'PAID'|'EXPIRED'
  expiresAt: Date|null
  remainingDays: number|null    // FREE/SUPER_ADMIN 은 null
  reason: 'not-subject'|'free'|'trial-active'|'paid-active'|'trial-expired'|'paid-expired'|'forced-expired'
}
```

### 2-4. EXPIRED 화이트리스트 (서버·프론트 공통 SSOT)

EXPIRED 유저가 접근 가능한 경로/API prefix **유일 정의**:

```
// src/features/subscription/policy.ts  (서버도 동일 파일에서 import 하거나, server/subscription/policy.js 미러)
EXPIRED_ALLOW_FRONTEND_PATHS = [
  '/profile',
  '/account/reset',
  '/feature-request',          // 문의·요청
  '/login',                    // 로그아웃 후 복귀
]

EXPIRED_ALLOW_API_PREFIXES = [
  '/api/auth/',                // 로그인/로그아웃
  '/api/me',                   // 프로필 조회
  '/api/profile',              // 프로필 수정
  '/api/account/',             // 비번 재설정 등
  '/api/subscription/',        // 구독 상태 조회·결제 연동 진입점(미래)
  '/api/feature-request',      // 문의 작성
  '/api/feature-requests/my',  // 내 문의 목록·삭제
]
```

**원칙**: 화이트리스트 방식. 신규 API/경로 추가 시 기본값은 차단 → 필요한 것만 명시적으로 허용.

---

## 3. 데이터 모델 변경

### 3-1. users 컬럼 추가 (마이그레이션 = initDb 확장)

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  subscription_plan TEXT NOT NULL DEFAULT 'FREE';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subscription_plan_check;
ALTER TABLE users ADD CONSTRAINT users_subscription_plan_check
  CHECK (subscription_plan IN ('FREE','TRIAL','PAID','EXPIRED'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS
  subscription_started_at TIMESTAMPTZ NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS
  subscription_expires_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS users_subscription_plan_idx
  ON users (subscription_plan);
CREATE INDEX IF NOT EXISTS users_subscription_expires_at_idx
  ON users (subscription_expires_at)
  WHERE subscription_expires_at IS NOT NULL;
```

**설계 결정**
- `FREE` 가 기본값 → 기존 전 유저 자동으로 FREE(무중단).
- 별도 `subscription_status` 컬럼 안 둠 → plan + expires_at 2개로 충분히 표현 가능. 저장 중복을 만들지 않음.
- 이력은 별도 테이블로 분리(아래 3-2).

### 3-2. 감사 이력 `subscription_change_logs`

```sql
CREATE TABLE IF NOT EXISTS subscription_change_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  changed_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  prev_plan TEXT NULL,
  next_plan TEXT NULL,
  prev_expires_at TIMESTAMPTZ NULL,
  next_expires_at TIMESTAMPTZ NULL,
  reason TEXT NOT NULL,            -- 'admin-manual' | 'admin-bulk' | 'self-checkout' (미래) | 'system-lazy-expire'
  memo TEXT NULL,                  -- 관리자 메모(옵션)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sub_change_logs_user_id_idx
  ON subscription_change_logs (user_id, created_at DESC);
```

### 3-3. 전역 설정 `app_settings` (신설)

TRIAL 기본 기간과 향후 유사 설정을 담을 key-value 설정 테이블.

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO app_settings (key, value_json)
VALUES ('subscription.trial_default_days', '30'::jsonb)
ON CONFLICT (key) DO NOTHING;
```

**확장성**: 추후 `payment.default_plan_price`, `ui.announcement_banner` 등도 여기에 쌓는다.

---

## 4. PR 분할 및 머지 순서

> 각 PR 은 **하위 호환** 을 유지한다. FREE 기본값 덕에 어느 단계에서 배포를 멈춰도 회귀 없음.

### PR1 — 데이터 모델 + 정책 함수 + 로그인/`/me` 응답 확장 (백엔드만)

**파일**
- `server/initDb.js` — 3-1/3-2/3-3 스키마 추가
- `server/subscription/policy.js` **(신규)** — `evaluateSubscription(input)` 순수 함수
- `server/subscription/applyToResponseUser.js` **(신규)** — `{ plan, expiresAt, effectiveStatus, remainingDays }` 병합
- `server/index.js` — 로그인·`/me` 응답에 `subscription` 객체 포함
- `src/features/subscription/policy.ts` **(신규)** — 정책 함수의 프론트 미러(같은 로직, TS)
- `src/features/auth/authApi.ts` — `LoginResponse.user.subscription` 타입 추가
- `src/features/auth/AuthProvider.tsx` — `user.subscription` 저장·복원

**완료 조건**: 로그인 후 `user.subscription = { plan:'FREE', effectiveStatus:'ACTIVE', ... }` 가 내려온다. 라우트/UI 변경 없음.

---

### PR1a — 정책 활성화 기계장치 (관리자 API)

> D2 결정(**"배포 ≠ 활성화"**)을 코드로 이행하는 단계. PR1 의 플래그(`policy_active`)에
> "스위치를 켜는 순간 TRIAL 타이머가 시작된다" 는 실제 동작을 부여한다.
> UI/라우트 가드는 아직 붙이지 않으므로 이 PR 이 배포되어도 일반 유저엔 영향이 없다.

**파일**
- `server/subscription/activatePolicy.js` **(신규)** — 트랜잭션 단위 상태 전환 SSOT
  - `activateSubscriptionPolicy({ actorUserId, trialDays?, dryRun?, memo? })`
    - 단일 트랜잭션으로 (a) 구독 주체 유저(`GA_ADMIN`/`GA_STAFF`/`USER`) 중 `plan='FREE'` AND `started_at IS NULL` 인 유저를 `TRIAL` 로 일괄 전환 → (b) `subscription_change_logs` 감사 로그 기록 → (c) `app_settings.subscription.policy_active = true`
    - `started_at/expires_at = NOW() / NOW() + trialDays` — 타이머 **기준점은 활성화 순간**
    - `dryRun=true` 는 READ-ONLY, 대상 유저 수만 반환
    - 이미 `started_at` 이 채워진 유저는 대상에서 제외 → **두 번째 활성화 호출이 기존 타이머를 덮어쓰지 않음**
  - `deactivateSubscriptionPolicy({ actorUserId })`
    - 플래그만 `false` 로 되돌리고 유저 타이머는 **보존** (비파괴적) → 재활성화 시 남은 기간 이어짐
  - `getSubscriptionPolicyStatus()` — 현재 플래그 + 영향 규모(`eligibleUserCount`/`trialUserCount`/`expiredUserCount`)
- `server/subscription/policy.js` — `SUBSCRIPTION_SUBJECT_ROLES` 를 `export` 로 승격 (정책 판정과 활성화 SQL 이 동일 SSOT 참조)
- `server/registerSubscriptionAdminApi.js` **(신규)** — HTTP 경계 전담
  - `GET  /api/admin/subscription/policy`     → 현재 상태 + 영향 규모
  - `POST /api/admin/subscription/activate`   → 본문 `{ trialDays?, dryRun?, memo? }`
  - `POST /api/admin/subscription/deactivate`
  - 전부 `requireAuth + requireSuperAdmin`
- `server/index.js` — `registerSubscriptionAdminApi(apiRouter, { requireAuth, requireSuperAdmin })` 등록

**완료 조건**
- SUPER_ADMIN 이 `POST /activate { dryRun:true }` 를 호출하면 `eligibleCount` 가 나오고 DB 상태는 그대로다.
- `POST /activate { trialDays:30 }` 호출 직후 대상 유저의 `subscription_plan='TRIAL'`, `subscription_expires_at ≈ NOW()+30d` 가 되어 있고 `subscription_change_logs` 에 `reason='policy-activation'` 기록이 남는다.
- 동일 호출을 두 번 해도 두 번째 호출에서는 `convertedCount=0` (기존 타이머 유지).
- `POST /deactivate` 후 플래그는 `false`, 유저 타이머는 그대로.

---

### PR2 — 서버 접근 제어 미들웨어

**파일**
- `server/subscription/requireActiveSubscription.js` **(신규)** — 화이트리스트 prefix 통과, 나머지는 `evaluateSubscription()` 으로 판정하여 403
- `server/index.js` — `requireAuth` 뒤에 **route-level 장착** 또는 **path prefix 기반 global 장착** 중 확정(아래 §5 결정)
- `server/subscription/endpoints.js` **(신규)** — `GET /api/subscription/me`, `POST /api/subscription/checkout` (checkout 은 501 "준비중")

**완료 조건**: 로컬에서 관리자 도구로 임의 유저를 `EXPIRED` 로 강제 시 업무 API 가 403 을 반환하고, 화이트리스트 API 는 200 유지.

---

### PR3 — 프론트 라우트 가드 + 메뉴 필터

**파일**
- `src/features/auth/RequireActiveSubscription.tsx` **(신규)** — `<Outlet/>` 래퍼, EXPIRED 면 `/profile?expired=1` 로 redirect
- `src/appRouter.tsx` — `/profile`, `/feature-request`, `/account/reset` 를 `RequireActiveSubscription` **바깥**에 두고, 나머지 업무 라우트를 **안**에 둔다
- `src/features/dashboard/gaTenantMenu.ts` — `buildGaTenantDashboardMenu(…, { effectiveStatus })` 로 확장. EXPIRED 면 `내정보관리` / `문의·요청` 만 반환
- `src/layouts/AppWorkspaceLayout.tsx` — menu build 시 subscription 상태 주입

**완료 조건**: EXPIRED 로 설정된 테스트 유저가 로그인 → 메뉴에 `내정보관리` / `문의·요청` 만 표시 → 업무 URL 직타 시 `/profile?expired=1` 로 리다이렉트.

---

### PR4 — 내 정보 관리 UI (구독 섹션)

**파일**
- `src/features/subscription/components/SubscriptionStatusCard.tsx` **(신규)** — 현재 플랜/만료일/남은기간/결제 안내
- `src/features/subscription/components/ExpiredBanner.tsx` **(신규)** — EXPIRED 유저용 상단 배너("이용 종료 — 결제/문의로 이동")
- `src/features/auth/pages/ProfilePage.tsx` — `SubscriptionStatusCard` 삽입
- `src/layouts/AppWorkspaceLayout.tsx` — effectiveStatus === 'EXPIRED' 이면 상단에 `ExpiredBanner` 렌더 (모바일/PC 공용)

**텍스트 상수 SSOT**: `src/features/subscription/copy.ts` — 플랜별 설명 문구를 한 곳에서 관리.

**완료 조건**: 각 상태별 유저가 `/profile` 진입 시 자신의 상태가 한 줄로 이해된다. EXPIRED 는 화면 전체에서 안내 배너가 상시 보인다.

---

### PR5 — 관리자 일괄 관리 UI + API

**백엔드**
- `server/subscription/adminEndpoints.js` **(신규)**
  - `GET  /api/admin/subscriptions` — 필터(ga, plan, status, near-expiry, expired-only), 페이지네이션
  - `PATCH /api/admin/subscriptions/:userId` — 단건 변경(plan / expires_at / memo)
  - `POST /api/admin/subscriptions/bulk` — 일괄 작업(userIds[] or gaId, action: 'SET_PLAN' | 'EXTEND_DAYS' | 'SET_EXPIRY')
  - `GET  /api/admin/settings/subscription` / `PATCH /api/admin/settings/subscription` — 기본 TRIAL 일수
- 모든 변경은 `subscription_change_logs` 에 기록

**프론트**
- `src/features/admin/pages/UserManagementPage.tsx` — 플랜 컬럼, 필터, 체크박스 다중선택, 툴바 액션
- `src/features/admin/components/SubscriptionBulkToolbar.tsx` **(신규)**
- `src/features/admin/components/SubscriptionEditDialog.tsx` **(신규)**
- `src/features/admin/pages/AdminSettingsPage.tsx` (없으면 신설) — TRIAL 기본 일수 설정

**완료 조건**: 관리자가 "특정 GA 전체에 30일 TRIAL" / "EXPIRED 유저 7일 연장" / "개별 유저 PAID 전환" 시나리오를 전부 UI 에서 수행 가능.

---

### PR6 — 감사 · 테스트 · 문서 정리

- `server/subscription/policy.test.js` — `evaluateSubscription()` 케이스(FREE/TRIAL-active/TRIAL-expired/PAID-active/PAID-expired/EXPIRED-forced/SUPER_ADMIN/INSURER_MANAGER/경계값(expires_at == now))
- `src/features/subscription/policy.test.ts` — 동일 케이스(프론트 미러와 서버 로직 일치 보증)
- `subscription_change_logs` 관리자 뷰 페이지(옵션, 선택 후순위)
- `docs/ops/subscription.md` — 운영 가이드(관리자 액션, 기본 TRIAL 설정 방법, EXPIRED 해제 방법)
- 이 계획 문서에 "완료" 마크

---

## 5. 설계 결정과 트레이드오프

### 5-1. **DB `plan` vs 런타임 계산** — 런타임 계산 채택
- 장점: cron 불필요, 시차/일광시간 변경에도 안전, "지금 이 순간" 정확.
- 단점: 관리자 리스트에서 `effective_expired` 로 필터링하려면 SQL 에서 `WHERE plan IN ('TRIAL','PAID') AND expires_at <= NOW() OR plan='EXPIRED'` 조건을 명시 필요 → 관리자 API 에서 이 계산을 서비스 층에 캡슐화.

### 5-2. **화이트리스트 vs 블랙리스트** — 화이트리스트 채택
- 신규 API/경로 추가 시 **기본값이 차단**. 개발자가 "이건 EXPIRED 도 허용" 이라고 명시해야 허용됨 → 보안 사고 방지.
- 트레이드오프: 일시적으로 EXPIRED 가 접근해야 할 새 엔드포인트가 생기면 의식적으로 등록해야 함 → 정책 파일(`EXPIRED_ALLOW_API_PREFIXES`) 하나에만 추가하면 됨.

### 5-3. **route-level vs global 미들웨어** — **path-prefix 기반 global** 채택
- 기존 코드가 route 단위로 `requireAuth` 를 붙이는 패턴이라 route 별로 `requireActiveSubscription` 추가는 회귀 범위가 크다.
- 대신 `app.use((req,res,next)=>...)` 전역에서 `req.path` 가 화이트리스트면 통과, 아니면 `requireAuth` 후 판정.
- 비인증 경로(로그인·회원가입·공개 페이지)는 `requireAuth` 가 없으므로 건너뛰어야 함 → 미들웨어가 `req.user` 있을 때만 동작.

### 5-4. **관리자 UI 확장 vs 분리** — `/admin/users` 확장 채택
- 같은 유저 레코드를 두 화면에서 편집하면 Mental model 이 분열됨.
- 플랜 컬럼이 추가되어도 유저 관리 UI 의 정체성은 그대로.
- 단, 필드·액션이 많아지면 탭 구조(`/admin/users` 의 "계정 정보" / "구독" 탭)로 내부 분할.

### 5-5. **TRIAL 기본 기간 저장 위치** — `app_settings` 테이블 채택
- env 변수로 하면 변경 시 서버 재배포 필요.
- 코드 상수로 하면 GA별 차등이 불가.
- DB 테이블은 관리자 UI 에서 즉시 변경 가능 + 확장성(장래 공지·기능 플래그).

### 5-6. **FREE 유저의 `expires_at`** — 항상 `NULL`
- 억지로 채우면 의미 혼동(10년 뒤 expires_at 같은 패턴). 
- CHECK 제약으로 `plan='FREE' AND expires_at IS NOT NULL` 같은 잘못된 상태를 방지할 수도 있으나 관리자 실수 시 500 에러 대신 서비스 층에서 정규화(`plan=FREE` 면 `expires_at=NULL` 로 강제)로 흡수. 이쪽이 운영 친화적.

### 5-7. **구독 대상 범위** — GA 일반 유저만
- 담당자 계정(INSURER_MANAGER/LOSS_ADJUSTER) 은 `insurer_managers` / `loss_adjusters` 별도 테이블. 이들은 GA 의 외부 협력사 성격 → 지금 스코프 제외.
- 정책 함수가 `role` 을 보고 "not-subject" 로 돌려주므로 확장 시 정책 파일 한 줄만 수정.

---

## 6. 회귀 방지 전략

- **각 PR 병합 직후**: `/dashboard` 정상 진입, 로그인, 로그아웃, `/profile` 열람 3종 기본 흐름 수동 체크.
- PR2 머지 후: 임시 테스트 계정을 DB 에서 수동 EXPIRED 설정 → 업무 API 가 403 인지, 화이트리스트가 200 인지.
- PR3 머지 후: EXPIRED 계정 로그인 → URL 직타 `/customers` → `/profile?expired=1` 리다이렉트.
- PR5 머지 후: 관리자 일괄 작업 시나리오 3종 수행, `subscription_change_logs` 에 기록 확인.

---

## 7. 열어둔 후속 과제 (스코프 밖)

- 실제 PG 결제 연동 (`POST /api/subscription/checkout` 내부 구현)
- 자동 영수증/청구서 발송
- 이메일 만료 임박 알림(D-7, D-1)
- GA 단위 플랜(여러 유저가 GA 계약에 묶이는 형태)
- INSURER_MANAGER / LOSS_ADJUSTER 계정 구독 확장
