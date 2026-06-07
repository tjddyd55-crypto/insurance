# PostgreSQL 환경 구분 (dev / prod / local)

> **2026-06-07 사고 교훈:** 로컬 `server/.env` 가 production Postgres public proxy 를 가리키면,
> 로컬 조사 count(724 customers 등)와 Railway dev UI count(0)가 **동시에 “맞는” 것처럼** 보여
> “데이터 삭제”로 오판하기 쉽다. 실제로는 **DB mismatch** 였다.

이 문서는 **어느 Postgres 인스턴스를 쓰는지** 를 구분하는 단일 참고용이다.
DATABASE_URL·비밀번호는 **절대 이 문서나 git에 넣지 않는다.**

---

## 1. 세 가지 런타임

| 구분 | 앱/API 접점 | Postgres 인스턴스 | public TCP proxy (예, 2026-06 기준) | 대표 데이터 규모 |
|------|-------------|-------------------|-------------------------------------|------------------|
| **Railway production** | `https://insurance-production-7bd8.up.railway.app` | production / `Postgres` | `shortline.proxy.rlwy.net` | users ~11, customers ~724, 템플릿·신청서·전자서명 데이터 있음 |
| **Railway development** | `https://insurance-dev.up.railway.app` | development / `Postgres` | `tramway.proxy.rlwy.net` | 신규/빈 DB에 가까움 (users 2, customers 0 등) |
| **로컬 개발** | `http://localhost:3000` → `localhost:3001/backend` | **`server/.env` 의 DATABASE_URL** 이 결정 | 아래 §2 참고 | `.env` 가 가리키는 인스턴스와 동일 |

Railway 앱 서비스(`app`)는 클라우드 내부에서 `postgres.railway.internal` 로 연결한다.
로컬 PC에서는 **Public Network URL** (`*.proxy.rlwy.net`) 만 사용 가능하다.

### 잘못된 dev URL (404)

| URL | 상태 |
|-----|------|
| `insurance-dev-production.up.railway.app` | **레거시** — 과거 `insurance-dev` 서비스 도메인. 현재 **404** |
| `insurance-dev.up.railway.app` | **정상** — `development/app` |

---

## 2. 로컬 `server/.env` 주의

- `server/.env` · `server/.env.local` 은 **gitignore** 대상이다 (secret 커밋 금지).
- 템플릿: `server/.env.example` → 복사 후 값만 채운다.
- **과거 실수:** `server/.env` 에 production public proxy(`shortline…`)를 두고
  “로컬 개발”이라 부르면서 **운영 DB** 를 조회·backfill 한 경우가 있었다.

### 권장 로컬 연결

| 목적 | DATABASE_URL |
|------|----------------|
| Railway **development** DB 와 동일하게 테스트 | development Postgres → Connect → **Public Network** (`tramway.proxy.rlwy.net`) |
| 운영 데이터 **읽기 전용** 조사 (주의) | production public proxy — **mutating script execute 금지** |
| 완전 로컬 | `localhost` Postgres (별도 volume) |

명시적 override (선택):

```env
# production | development | local — dbEnvironmentGuard 분류용
INSURANCE_DB_ENVIRONMENT=development
```

---

## 3. 서버/스크립트 가드 (코드)

| 시점 | 동작 |
|------|------|
| `server/db.js` 로드 | masked fingerprint 로그 + 로컬 프로세스가 production proxy 이면 **경고** |
| `initDb` + `INSURANCE_DEBUG_RESET_ALL_USERS` | Railway 차단 · production proxy 차단 · `INSURANCE_ALLOW_DESTRUCTIVE_RESET=I_UNDERSTAND_DELETE_USERS` 필요 |
| `customer-geocode-backfill.mjs --execute` | fingerprint 출력 · **production DB execute 차단** |

프록시 host 목록 SSOT: `server/config/dbEnvironmentTargets.js`  
(Railway 가 proxy 를 바꾸면 코드·이 문서 함께 갱신)

---

## 4. dev 테스트 DB 준비 (clone 복구 runbook)

**아직 실행하지 않음 — 승인 후 Dashboard/CLI 로만 진행.**

목표: 지도·신청서·전자서명 UI 검증을 **development app** 에서 하려면,
development Postgres 에 **production 과 유사한 데이터** 가 필요하다.

### 절대 금지

- production Postgres 를 development `app` 의 `DATABASE_URL` 에 **직접** 연결
- production DB 에 geocoding backfill / 테스트 write
- 현재 development DB 에 **백업 없이** in-place restore
- restore 전 현재 dev DB snapshot 없이 덮어쓰기

### 권장 절차

1. **Railway Dashboard** → production / `Postgres` → **Backups / Snapshots** 존재·시점 확인
2. snapshot 을 **새 Postgres 서비스** 또는 **clone volume** 으로 restore (이름 예: `Postgres-dev-clone`)
3. clone 에서 read-only count 확인  
   `users`, `customers`, `contract_templates`, `contract_send_sessions`, `pdf_templates`, `pdf_template_fields`
4. count 정상일 때 **development / `app`** 의 `DATABASE_URL` reference 를 clone Postgres 로 변경
5. development `app` 재배포 (source branch: `develop`)
6. `https://insurance-dev.up.railway.app/backend/health` → 200
7. dev admin UI 에 기존 규모 데이터 표시 확인
8. **그 다음에만** 지도 backfill: `--limit 5` → `--limit 20` → 전체

### 복구 대안

| 방식 | 장점 | 주의 |
|------|------|------|
| prod snapshot → **새 dev clone** | prod 무손상, dev 와 prod 분리 유지 | clone 후 reference 전환만 dev 에 적용 |
| prod snapshot → dev Postgres **in-place** | 서비스 수 적음 | **현재 dev DB 백업 필수**, 실수 시 dev 전용 데이터 소실 |

Railway CLI 로 snapshot 목록 API 가 계정/플랜에 따라 제한될 수 있다. **Dashboard 확인이 1차.**

---

## 5. 지도 feature dev 검증 순서 (데이터 준비 후)

1. dev DB clone 데이터 준비 (§4)
2. `feat/customer-location-map-mvp` 를 development `app` 에 **임시** 배포 (승인 시)
3. development env NAVER 변수 확인 · `naver-maps-smoke-test.mjs --railway-development`
4. backfill **dry-run**
5. `--execute --limit 5` (dev DB만)
6. `/customers/map` UI · 상세 이동 · 지도 복귀

---

## 6. develop hotfix 반영 상태 (2026-06-07)

| commit | 내용 |
|--------|------|
| `da2da9e` | 고객등록 GA FILTER hotfix |
| `5487ab6` | initDb destructive reset guard |
| `a540a12` | username 중복 체크 (case-insensitive) |

development `app` 배포 commit ≥ `a540a12` 이면 hotfix 반영됨.  
dev DB 가 비어 있으면 “기존 고객/유저 안 보임”은 **hotfix 미반영과 무관**.

---

## 7. fingerprint 수동 확인 (read-only)

로컬에서 public URL 로만 조사할 때 (password 는 env 에만):

```sql
SELECT current_database() AS db_name, current_user AS db_user,
       inet_server_addr()::text AS server_addr, inet_server_port() AS server_port;
```

production 과 development 는 **`inet_server_addr()` 가 다르다** (2026-06: `10.142.x` vs `10.145.x`).

---

## 8. 관련 파일

| 파일 | 역할 |
|------|------|
| `server/config/dbEnvironmentTargets.js` | 알려진 public proxy host |
| `server/lib/dbEnvironmentGuard.js` | 분류·경고·execute 차단 |
| `server/.env.example` | 로컬 env 템플릿 (secret 없음) |
| `AGENTS.md` §3-1 | dev/prod URL · branch 매핑 |
