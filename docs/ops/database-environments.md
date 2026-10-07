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

## 4. dev 테스트 DB 준비 — prod clone runbook (승인 전 실행 금지)

> **상태:** 2026-06-08 조사·runbook 작성 완료. **clone / restore / DATABASE_URL 변경은 사용자 “실행 승인” 전까지 금지.**

### 4-1. 목표

production Postgres **원본은 유지**하고, 그 데이터를 **복사본(clone)** 으로 development `app` 이 사용하게 한다.

| 금지 | 이유 |
|------|------|
| production DB → development `app` **직접** `DATABASE_URL` 연결 | dev 테스트 쓰기가 prod에 반영됨 |
| production DB에 backfill / 고객등록 / 신청서 테스트 | 운영 데이터 오염 |
| 현재 development Postgres에 **백업 없이** in-place restore | 빈 dev DB·신규 계정 소실 |
| production Postgres 서비스에서 Backup **Restore → Deploy** (동일 서비스 볼륨 교체) | **운영 DB 볼륨이 바뀌는 staged 변경** — clone 목적에 부적합 |

### 4-2. 현재 fingerprint 스냅샷 (read-only, 2026-06-08)

| 대상 | Railway env | public proxy (마스킹) | `server_addr` | PG | users | customers | contract_templates | pdf_templates |
|------|-------------|------------------------|---------------|-----|------:|----------:|-------------------:|----------------:|
| **production** `Postgres` | production | `shor***.net:17109` | `10.142.132.120` | 17.7 | 11 | 724 | 8 | 3 |
| **development** `Postgres` | development | `tram***.net:44319` | `10.145.29.186` | 17.9 | 2 | 0 | 0 | 0 |
| **local** `server/.env` | (로컬) | `shor***.net` (= **production**) | `10.142.132.120` | 17.7 | 11 | 724 | 8 | 3 |

production 상세 count (동일 시점): `insurance_forms` 3 · `contract_send_sessions` 40 · `pdf_template_fields` 49 · `tenants` 2 · orphan customers 0 · `admin`/`tjddyd55` 존재.

development: `consent_templates` 6 (initDb 시드만), 도메인 데이터 없음.

### 4-3. Railway backup / snapshot (Dashboard 1차 — CLI 미실행)

Railway CLI `volume list`는 **현재 link된 environment** 기준만 보여 줄 수 있다. backup 목록·시각은 **Dashboard → CRM-Platform → production → `Postgres` → Backups** 에서 확인한다.

| 확인 항목 | Railway 문서 기준 | 이번 조사 |
|-----------|-------------------|-----------|
| Volume backup (Daily/Weekly/Monthly) | 서비스 Backups 탭에서 수동·스케줄 가능 | **Dashboard에서 미클릭 확인 필요** (CLI로 snapshot 시각 미조회) |
| Backup Restore | **동일 project + 동일 environment** 의 **동일 Postgres 서비스**에 staged volume 교체 | prod 서비스 in-place — **clone 용도로 사용 금지** |
| PITR (Point-in-Time Recovery) | 활성화 시 타임스탬프 복원 → **새 sibling Postgres 서비스** 생성, **원본 미변경** | **Dashboard에서 PITR 활성 여부 미확인** — 활성화돼 있으면 prod env 내 fork 후 pg_dump 경로 가능 |
| cross-environment restore | Volume backup은 **다른 environment로 직접 restore 불가** | dev env clone은 **pg_dump/pg_restore** 또는 prod env fork → dump 권장 |

**승인 전 Dashboard 체크리스트 (실행 없음):**

1. production / `Postgres` / **Backups** — 스케줄(Daily/Weekly/Monthly)·수동 backup 존재 여부
2. 각 backup **타임스탬프** (가장 최근)
3. **PITR** 탭 — 활성화 여부·복원 가능 window
4. development / `Postgres` / Backups — 현재 빈 DB **rollback용** snapshot 생성 여부 (전환 **전**)

### 4-4. 추천 clone 방식 (우선순위)

#### 방식 A — **권장:** `pg_dump` → development 신규 Postgres (원본 무손상)

1. development environment에 Postgres 서비스 **신규 추가** (이름 예: `Postgres-dev-clone` 또는 `insurance-dev-clone-from-prod-YYYYMMDD`)
2. **read-only** `pg_dump` from production `DATABASE_PUBLIC_URL` (마스킹 host `shor***.net`)  
   - `--no-owner --no-acl` · custom 또는 directory format  
   - **production에 쓰기 없음**
3. `pg_restore` → 신규 development Postgres `DATABASE_PUBLIC_URL` (`tram***` 계열 **새 인스턴스**)
4. §4-5 count 검증 — production과 **동일 order of magnitude** 확인
5. 승인 후 §4-6 development `app` `DATABASE_URL` reference만 신규 clone으로 변경

#### 방식 B — PITR fork (PITR 활성화된 경우만)

1. Dashboard PITR → 원하는 시각 → **새 sibling Postgres** (`…-restored-…`) in **production environment**
2. fork에서 read-only count 검증 (production 원본 untouched)
3. fork `DATABASE_PUBLIC_URL` 로 `pg_dump` → development 신규 Postgres `pg_restore` (cross-env)
4. development `app` 은 **development env clone만** 참조 — production env fork에 직접 연결하지 않음

#### 방식 C — **비권장:** production Backup Restore (in-place)

동일 `Postgres` 서비스 volume staged 교체 → **운영 cutover 위험**. dev clone 목적에 **사용하지 않음**.

### 4-5. clone DB 생성 후 검증 (SQL, read-only)

clone `DATABASE_PUBLIC_URL` 로만 접속. **development `app` DATABASE_URL 변경 전**에 실행.

```sql
-- fingerprint
SELECT current_database(), current_user, inet_server_addr(), inet_server_port(), left(version(), 80);

-- core counts
SELECT
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM customers) AS customers,
  (SELECT COUNT(*) FROM tenants) AS tenants,
  (SELECT COUNT(*) FROM insurance_forms) AS insurance_forms,
  (SELECT COUNT(*) FROM contract_templates) AS contract_templates,
  (SELECT COUNT(*) FROM contract_send_sessions) AS contract_send_sessions,
  (SELECT COUNT(*) FROM pdf_templates) AS pdf_templates,
  (SELECT COUNT(*) FROM pdf_template_fields) AS pdf_template_fields,
  (SELECT COUNT(*) FROM consent_templates) AS consent_templates;

-- orphan customers
SELECT COUNT(*) AS orphan_customers
FROM customers c
LEFT JOIN users u ON c.user_id = u.id
WHERE c.user_id IS NOT NULL AND u.id IS NULL;

-- key accounts (username only)
SELECT username, role, is_deleted FROM users WHERE username IN ('admin', 'tjddyd55');
```

**합격 기준 (production 대비):**

| metric | production (2026-06-08) | clone 허용 편차 |
|--------|-------------------------|-----------------|
| users | 11 | ±0 (또는 설명 가능한 diff) |
| customers | 724 | ±0 |
| contract_templates | 8 | ±0 |
| contract_send_sessions | 40 | ±0 |
| pdf_templates | 3 | ±0 |
| pdf_template_fields | 49 | ±0 |
| orphan_customers | 0 | 0 |

count가 크게 다르면 **DATABASE_URL 전환하지 않음**.

### 4-6. development `app` DATABASE_URL 전환 (승인 후만)

**변경 대상:** CRM-Platform / **development** / **`app`** 의 `DATABASE_URL` reference **만**.  
**절대 변경 금지:** production / `app` · production / `Postgres` · production `DATABASE_URL` 원문.

| 단계 | 작업 |
|------|------|
| 0 | development / `Postgres` (현재 빈 DB) **Backups** — rollback용 snapshot/메모 |
| 1 | 현재 development `app` → `Postgres` reference **기록** (Railway Variables UI / Variable History — **값 원문 외부 유출 금지**) |
| 2 | 현재 dev DB fingerprint 기록 (`10.145.29.186`, users 2) |
| 3 | clone Postgres 서비스 `DATABASE_URL` / internal reference 확인 |
| 4 | development `app` `DATABASE_URL` → **clone Postgres** reference 로 변경 |
| 5 | development `app` 재배포 (source branch: `develop`) |
| 6 | `https://insurance-dev.up.railway.app/backend/health` → 200 |
| 7 | `https://insurance-dev.up.railway.app/version.json` — 배포 commit 확인 |
| 8 | masked fingerprint — `server_addr` 가 clone과 일치하는지 (앱 로그 `[db] connection]` 또는 read-only SQL) |
| 9 | admin 로그인 → 유저·고객·신청서·전자서명·PDF 템플릿 UI spot check |

### 4-7. Rollback (승인 후 전환 시 필수 준비)

| 단계 | 작업 |
|------|------|
| 1 | 전환 전 development `app` `DATABASE_URL` reference **안전 기록** (Variable History) |
| 2 | 문제 발생 시 reference를 **기존 development `Postgres`** (`tram***.net`, `10.145.29.186`) 로 복원 |
| 3 | development `app` 재배포 |
| 4 | `/backend/health` 200 |
| 5 | fingerprint — users ≈ 2, customers 0 으로 복귀 확인 |

**DATABASE_URL 원문은 보고·문서·git에 넣지 않는다.**

### 4-8. 지도 feature 검증 (clone 전환 **후에만**)

Railway development Source Branch는 **`develop`** (`docs/ops/railway-deployment.md`).  
feature 브랜치를 Railway에 직접 연결하지 않는다.

1. 지도 관련 커밋을 **승인 후 `develop`에 cherry-pick/merge** → `develop` push → development 재배포
2. development env: `NAVER_MAPS_CLIENT_ID` / `NAVER_MAPS_CLIENT_SECRET` / `MAP_PROVIDER=naver` / `MAP_RENDER_MODE=dynamic` / `VITE_NAVER_MAP_CLIENT_ID`(프론트 Dynamic Map) — **Web 서비스 URL 등록**: `docs/ops/naver-maps-dynamic-map-setup.md`
3. `node server/scripts/naver-maps-smoke-test.mjs --railway-development`
4. `customer-geocode-backfill.mjs --dry-run`
5. `--execute --limit 5` (**clone DB만** — `dbEnvironmentGuard` 가 production execute 차단)
6. `/customers/map` UI · 상세 이동 · 지도 돌아가기 · mapState 복원
7. `--limit 20` → 필요 시 전체 (순차)

### 4-9. 위험 요소

| 위험 | 완화 |
|------|------|
| production Backup Restore in-place | **사용 금지** — 방식 A/B만 |
| dev `app`이 prod DB reference | 전환 체크리스트 · `dbEnvironmentGuard` |
| local `server/.env` prod proxy 착시 | `server/.env.example` · startup 경고 |
| clone count 불일치 | 전환 전 SQL gate |
| rollback reference 분실 | Variable History + 전환 전 메모 |
| PITR 미활성 | 방식 A (`pg_dump`) 단독 |

### 4-10. 승인 전 실행 금지 목록

- production / development Postgres **Restore / Deploy** 클릭
- 신규 Postgres **clone 서비스 생성**
- `pg_restore` / backfill **`--execute`**
- development / production **`DATABASE_URL` Variables 변경**
- production DB **쓰기** (INSERT/UPDATE/DELETE/TRUNCATE)
- 현재 development Postgres **in-place 덮어쓰기**

---

## 5. 지도 feature dev 검증 순서 (데이터 준비 후)

§4-8 과 동일. clone DB + dev URL 전환 **승인 후** 진행.

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
