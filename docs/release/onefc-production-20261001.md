# ONE FC production audit — 2026-10-01

비교 기준: `origin/main` `8ef3814aa194a501b96510026df12232df631775`.
develop (기능 머지 후): `fd247b43884d55de69ebfe22202e120fd41624ae`.
PR #48 merge SHA: `66a09ac93c0cb5893c496ce4014cdc0a81480f3c`.
릴리스 브랜치: `release/onefc-production-20261001` (origin/main 위에서 세 기능만 cherry-pick).

## 분류 요약

- A 운영 후보: 533
- B QA/테스트/문서: 6
- C 폐기/실험: 0
- D 중복(patch-id가 main과 동등): 374
- 합계: 913 (`origin/main..origin/develop`, 기능 머지 커밋 포함)

## 이번 릴리스에 넣은 것

- 서비스 연동, 지역별 고객, 알림 달력/전체 알림. develop 기능 커밋 `24a9b29b`를 main 위에 cherry-pick (`1b80ec55` 이후 문서 커밋).
- 충돌 1건(`src/components/form/index.ts`)은 main의 `parseAddressFromSave` / `parseAddressFromStored`를 유지하고 지역 필드 export를 더했다.
- main의 `메뉴 권한 SSOT`와 오늘 알림의 `알림일` 라벨(`CUSTOMER_ALERT_DATE_LABEL`)은 그대로 둔다.

## 이번 릴리스에 넣지 않은 것

- D: main에 이미 동등 패치가 있는 커밋. 정부지원 초기 커밋 13건도 patch-id 기준으로 D다.
- B: QA 캡처, 테스트 전용, CI/문서.
- A 가운데 세 기능이 아닌 이력은 재적용하지 않았다. main이 merge-base 이후 769커밋 앞서 있고, develop 트리를 통째로 합치면 운영 보장분석 3단 편집기, 메뉴 권한 매트릭스, `지정일`→`알림일`이 되돌아간다.

## 지정 점검

| 항목 | 판단 | 이유 |
|---|---|---|
| 보장 시뮬레이터 / PR #48 | D에 가깝게 이미 main에 동등 패치. 파일 트리는 이후 main 편집기가 더 앞섬 | `coverageSeoulDate.js`, `InlineTitleQuickEdit.tsx`는 develop에만 있고 main 편집기 경로가 다르다. 통째 교체는 운영 UI 회귀. |
| 공개 공유 줌 / PDF | main 유지 | develop PDF 파일명 헬퍼는 main 트리에 없다. 운영 PDF 파이프라인은 main 쪽 최신 커밋을 유지. |
| 인라인 제목/금액 | main 유지 | main에도 `InlineAmountQuickEdit`가 있다. develop 전용 제목 컴포넌트만 추가 이식하지 않음. |
| 메뉴/권한 | main 유지 | develop에는 `/admin/menu-permissions`가 없다. 릴리스 메뉴는 main + `서비스 연동`. |
| 알림 `지정일`→`알림일` | main 유지 | develop 오늘 알림 설정은 아직 `지정일`. 릴리스의 오늘 알림은 `알림일`. 새 달력/목록 유형명은 `고객 지정 알림`. |
| SMS | 기존 경로 유지 | 알리고 설정 UI는 `/sms/settings`. 새 테이블에 비밀을 복제하지 않음. 운영 인증문자와 CRM 문자는 기존 분리 유지. worker 주석 차이만 develop에 있어 릴리스에 안 넣음. |
| PR #45 view modes | D / main 유지 | view mode 커밋 patch-id가 main과 동등한 것이 있고, 이후 main이 3단 편집기로 진행. |

## 아키텍처

### 연동 제공자 레지스트리

`server/integrations/providerRegistry.js`의 `SERVICE_PROVIDERS`가 카드 목록의 단일 원천이다. 메뉴는 `서비스 연동` 하나다. Google/Naver는 `GOOGLE_OAUTH_CLIENT_ID` / `NAVER_OAUTH_CLIENT_ID`가 없으면 상태 `미설정`이고 connect는 409다. 비밀은 요청 본문으로 받지 않고, 저장 시 기존 `encryptSmsCredential`만 쓴다. 알리고 키는 `sms_provider_accounts`에만 있다.

### 지역 정규화

`customers.address`는 수정하지 않는다. `address_sido`, `address_sigungu`, `address_eupmyeondong`만 추가한다. 저장 시 카카오 우편번호의 sido/sigungu/bname이 우선하고, 없으면 주소 문자열을 파싱한다. 세종특별자치시는 시군구를 null로 둔다. 백필은 부팅 시 실행하지 않고 `server/scripts/runAddressRegionBackfill.mjs` dry-run이 기본이다.

### 알림 집계

`notifications` 발생 로그가 아니라 예정 원천만 모은다. 상령일은 `customers.next_age_date`, 자동차 만기는 `customer_cars.renewal_date`(없으면 `customers.renewal_date`), 고객 지정 알림은 `customer_special_dates`의 매년 월-일이다. 이벤트는 id, type, title, startDate, customerId, source, owner 범위를 가진다. 날짜 컬럼은 달력 날짜 그대로 쓰고, 오늘/월 이동만 Asia/Seoul이다.

## 마이그레이션과 운영 사전 조회

서버 기동 시 `initDb`가 아래를 추가한다. 컬럼 drop, 대량 UPDATE, owner 제약 완화는 없다.

1. `customers.address_sido`, `address_sigungu`, `address_eupmyeondong` (nullable TEXT)
2. `idx_customers_region_owner` on `(ga_id, COALESCE(owner_user_id, user_id), address_sido, address_sigungu, address_eupmyeondong)` WHERE `deleted_at IS NULL AND address_sido IS NOT NULL`
3. `service_integrations` + owner_scope CHECK + status CHECK + partial unique indexes

사전 건수 (프로덕션에서 SELECT만):

```sql
SELECT
  COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active_customers,
  COUNT(*) FILTER (
    WHERE deleted_at IS NULL AND btrim(address) <> ''
      AND address_sido IS NULL AND address_sigungu IS NULL AND address_eupmyeondong IS NULL
  ) AS pending_backfill,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND address_sido IS NOT NULL) AS with_sido
FROM customers;
```

컬럼이 생기기 전에는 `information_schema.columns`로 존재 여부만 확인한다.

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'customers' AND column_name IN ('address_sido','address_sigungu','address_eupmyeondong');
```

```sql
SELECT to_regclass('public.service_integrations') AS service_integrations;
```

백필 적용은 배포 후 별도다. dry-run: `node server/scripts/runAddressRegionBackfill.mjs`. 반영: 같은 명령에 `--apply`. 실패 주소는 null로 남고 원문 address는 바뀌지 않는다. 두 번째 실행은 이미 채워진 행을 건너뛴다.

## 네이티브 앱 권고

- 서비스 연동: insurance-mobile에 설정 화면으로 넣을 만하다. OAuth는 시스템 브라우저이고, 비밀 입력칸은 네이티브에도 두지 않는다. 클라이언트 ID가 생기기 전에는 웹과 같이 `미설정`만 보여 준다. 알리고는 기존 SMS 설정으로 딥링크.
- 지역별 고객: 네이티브 고객 지도에 목록 탭으로 넣는 것이 맞다. 지도 구현을 복제하지 않고 `GET /api/customers/regions`를 재사용한다.
- 알림 달력/전체: 네이티브 알림 화면에 같은 세 탭을 두는 것이 맞다. 푸시 발생 로그와 스케줄 집계는 분리된 채로 둔다.
- 이번 변경은 웹만 구현했다.

## 커밋 분류

| commit | title | category | reason |
|---|---|---|---|
| `fd247b43884d` | merge: service integrations, region customers, and reminder calendar | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `24a9b29bd352` | feat(crm): add service integrations, region customers, and reminder calendar | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `66a09ac93c0c` | merge: PR #48 coverage-simulator web parity into develop | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3e1bae490805` | fix(coverage-simulator): show dates on the Seoul calendar | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `329a4c8a343b` | fix(coverage-simulator): center mobile reorder arrows on the divider | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `5fa279966a27` | fix(coverage-simulator): keep mobile amount boxes at their original size | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `0d6f3ce88b59` | fix(coverage-simulator): keep wide 만원 amounts fully visible | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `17897b7e2f1e` | fix(coverage-simulator): restore amount text and enrich saved customer chip | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `1d51c21937e2` | fix(coverage-simulator): align web timeline, PDF names, and saved customer | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `313ac3e56ad6` | fix(personal-binder): stack edit fields and default viewer to fit-page | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `5e954df49283` | fix(personal-binder): align material add modal with dialog SSOT | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `507037d42283` | test(qa): count default timeline rows for viewmode scroll | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `a587b35e7e97` | fix(coverage-simulator): move view modes to header and fix alt scroll | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `85011b5b22be` | fix(coverage-simulator): wire option3 grid SSOT and bundle alt-view CSS | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `3d35d7121671` | fix(qa): align linked-customer picker and final regression harness | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `ff9bd45a5d8d` | test(qa): harden Grok visual regression Playwright checks | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `df8a54e39e48` | fix(ui): restore search picker top anchor for coverage customer modal | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `68cd6ea0c5df` | fix(coverage-simulator): restore Grok UI baseline from main on feature branch | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `03f4d7ec84cb` | docs(ops): require explicit Railway environment on source connect | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `f41b5f6f961a` | fix(initdb): preserve contact owner invariant in coverage feature branch | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `a986791a554d` | fix(coverage-simulator): handle legacy_client_id unique conflicts on import | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `df847513344a` | feat(coverage-simulator): persist CRM templates and simulations on server | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `9361a4f2eafa` | feat(coverage-simulator): enable system scenarios and user scenario management | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `b03b8da68cb6` | Merge PR #47: schedule calendar and binder media | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `9f0b5f2347eb` | test(qa): cover schedule calendar and binder media flows | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `d7558a66dfe2` | feat(personal-binder): support image materials and merged PDF uploads | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `94458db339e8` | refactor(pdf): share raster image PDF generation | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `28a9c1887ec9` | feat(todos): add monthly calendar view alongside list | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `60f203f983eb` | merge: preserve coverage simulator PDF fixes | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `91e837ee0783` | feat(coverage-simulator): add compact, stacked, and grid view modes | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `c4d67078dc78` | feat(personal-binder): render binder pages to cached JPEG images | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `8dd53b502e61` | fix(dashboard): 고객 상담 하위를 내 바인더·보장 시뮬레이션으로 고정 (#36) | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `a70836a2f0dc` | feat(dashboard): add 고객 상담 menu for coverage simulation | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `e07178b4b807` | test(billing): keep active-trial entitlement fixture in the future | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `70e49c0bad9e` | feat(personal-binder): merge selected original pages into one binder PDF | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `814a33700fcc` | chore(qa): refresh badge optical capture evidence on DEV | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `20d3996a8c6c` | fix(coverage-simulator): refine badge glyph margin optical offset | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `fccc33130d5d` | fix(coverage-simulator): use margin-based badge glyph optical alignment | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `871c9820b945` | fix(coverage-simulator): tune badge glyph optical offset for capture | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `eb5bb6ad561a` | fix(coverage-simulator): strengthen badge glyph optical correction | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `ca221e382e03` | fix(coverage-simulator): widen mobile PDF preview and optically center badge glyphs | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `1722fb173586` | fix(personal-binder): stabilize viewer page navigation and QA scripts | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `12e32e21585d` | fix(personal-binder): clean child references on binder delete | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `0a8ad62f9817` | fix(personal-binder): load owned binder child records | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `d186fad856da` | fix(personal-binder): execute owned child mutations safely | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `7198ff08697f` | feat(personal-binder): build responsive editor and consulting viewer | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `fa7d0bbed846` | feat(personal-binder): add client domain and page selection SSOT | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `812c88c1acf8` | feat(personal-binder): add private binder domain API | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `3a1113df5392` | fix(coverage-simulator): stabilize PDF preview and center print badges | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `63bc825fa4d2` | test(coverage-simulator): rasterize DEV PDF artifacts locally | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `833fa48f2d28` | fix(coverage-simulator): finalize PDF raster and pagination pipeline | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `7038f3eee10d` | fix(coverage-simulator): PDF-only Korean text clipping finalization | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `109ab64aadfe` | fix(coverage-simulator): PDF clipping and share viewer sticky totals | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `c4ecc9ebaa1f` | feat(coverage-simulator): unify timeline Visual SSOT for share and PDF | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `8ae1da94f9e1` | Use HTTPS attachment for public share PDF downloads | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `bbb980288ee9` | Fix persisted consultation state after draft save | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `d3d39d5d2803` | Reuse newsletter zoom and HTTPS PDF artifact downloads | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `28cef3e36c44` | Restore preview share button and fix mobile PDF fit-to-width download. | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `ef488e572e91` | Stabilize coverage share history, PDF preview zoom, and share auth UX. | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `6cd3f18996d7` | Fallback to snapshot-based PDF on public share when server PDF is not ready. | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `3479e9cec70e` | Add coverage simulator customer share snapshots and public viewer. | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `dc0da5b662c4` | Fix PDF html2canvas compatibility and PDF QA download flow. | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `c9b23ec9ec13` | Finalize coverage simulator PDF to match mobile timeline layout. | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `942499ced451` | Improve coverage simulator mobile totals hierarchy and timeline reorder. | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `b2b87fa7d054` | Fix coverage simulator hook smoke for empty consultation list routes. | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `3668462610f8` | Fix coverage simulator mobile form with exclusive in-root screens and shared primitives. | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `8e320755b328` | Replace coverage simulator add/edit bottom sheets with full-screen forms and fix reorder. | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `466b912e0ef1` | Use muted token for mobile editor secondary actions. | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `4ca56ab2278c` | Align coverage simulator UI with ONE FC design tokens and shared sheets. | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `fa4774bfe699` | Fix React #310 by moving hooks before scenario early return. | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `94578c04de29` | Simplify mobile item edit: direct sheet, reorder fix, wider inline amount. | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `85b9a36c4185` | Stabilize mobile coverage simulator overlays and inline amount edit. | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `af6f4d0f1cf5` | fix(coverage-simulator): hooks order before scenario loading guard | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `bdfef2d15ac3` | fix(coverage-simulator): dedicated simulation list action sheet UI | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `dd767f9c5bc8` | feat(coverage-simulator): mobile inline amount edit and overlay scroll lock | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `8e5fdc090001` | fix(coverage-simulator): item action sheet z-index outside root scope | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `7ecea91cbf46` | fix(coverage-simulator): document CRUD, save dirty state, and item action sheet | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `bb81d291d530` | feat(coverage-simulator): simulation list flow and explicit save feedback | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `97574338b4d1` | style(coverage-simulator): flat mobile amounts and centered time markers | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `bd16ab33cd4a` | style(coverage-simulator): drop period section tint, highlight subtotal and markers | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `ece5108cbee9` | fix(coverage-simulator): portal action sheet layer and period section grouping | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `ecbfffd8b4f6` | fix(coverage-simulator): mobile item action sheet and multi-marker period inserts | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `9d3ba8596ba9` | fix(coverage-simulator): portal row menu and insert after last time marker | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `71c092aa8a75` | chore: update mobile period subtotal screenshots | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `ef41144c5c69` | fix(coverage-simulator): refine period subtotal and time marker visuals | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `4ef5eae31186` | feat(coverage-simulator): period subtotals before time markers | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `d6d81ee76f04` | fix(coverage-simulator): align event header row and horizontal time separator | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `19cb1065ff85` | fix(coverage-simulator): split mobile event header columns and mask axis line | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `3112fef1b561` | fix(coverage-simulator): scope CustomerProvider to preview and CRM route layouts | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `d8e3699c1c35` | feat(coverage-simulator): center event titles and home customer context | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `8e4d1bc3f8e4` | fix(coverage-simulator): refine mobile timeline insert line and spacing rhythm | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `1e376bc9b516` | fix(coverage-simulator): align mobile preview header and totals dock | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `bdc6417578ca` | fix(coverage-simulator): reduce mobile dock divider stretch height | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `f76eaa16fcd4` | fix(coverage-simulator): shrink mobile totals dock to single-line columns | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `dad1728683d6` | feat(coverage-simulator): compact mobile insert, header, dock, and inline add | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `389cba364b75` | feat(coverage-simulator): mobile preview density and catalog favorites | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `b233fe7a5143` | feat(coverage-simulator): mobile preview sticky total summary dock | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `9d89de819f97` | feat(coverage-simulator): custom user templates and center-axis preview UI | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `869a6b4fe2ea` | chore(qa): close sheet before PC preview save in visual capture | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `805b9fcec18e` | feat(coverage-simulator): split public preview into PC and mobile routes | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `bd17c08fa573` | chore(qa): point coverage simulator captures at public preview | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `b817c865804f` | feat(coverage-simulator): public web preview route and visual QA | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `457406c488ce` | feat(coverage-simulator): add mobile-first web MVP with PDF | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `b072b845bd67` | fix(push): fail outbox delivery when no active devices | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `be73b44894ec` | fix(billing): allow GA restriction page for unpaid users | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a22fb137013d` | fix(entitlements): align customer route policy and PC group badges | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `c0d18dcadd75` | fix(navigation): show entitlement badges on PC top menu groups | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `82bfa3988dcb` | test(entitlements): add IDOR and four-tier integration coverage | B | QA·테스트·캡처 전용. |
| `9fc9d9e9d2ba` | feat(contacts): add personal contacts entry on profile for general users | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `762be5c671bc` | feat(contacts): support personal insurer contacts for general users | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `90f9f0b14bb5` | feat(navigation): add entitlement badges and route guards | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `5f56f4d7a4d1` | feat(entitlements): add free paid and ga feature policy | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `0b4238541e88` | fix(billing): remove automatic signup access period | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `cb6341ef81f4` | fix(insurance): align alimtalk button urls with approved templates | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `67ebb23c33a2` | chore(ops): harden DEV kakao QA env disable script | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `b86980024bc6` | feat(alimtalk): gate dev share-link sends with recipient allowlist | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `43190eb12ae8` | fix(newsletters): expose publisher company names | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `fe83023c6468` | test(security): cover tenant isolation for native release apis | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `633290fd6680` | fix(customer-news): align empty publish validation message | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `59cb4fca6b89` | fix(profile): include ga_code on /api/me response | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `62530634f694` | feat(customer-news): add newsletter comments api | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `832052451723` | fix(files): allow special characters in customer display filenames | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `1a6100aa399c` | test(customers): add schema and mapping checks for business/fire info | B | QA·테스트·캡처 전용. |
| `e8c25611370f` | fix(customers): correct customer insert placeholders | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `4d0419dd9653` | feat(customers): add business info and fire insurance locations | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `7591f717391b` | fix(customer-files): render compact actions as floating menu | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3b8345f0f378` | fix(customer-files): respond to explorer width instead of viewport | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `6786986b9e04` | fix(customer-files): align folder and file rows across desktop widths | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `bc5813f7ac28` | fix(customer-files): improve responsive filename visibility and panel alignment. | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `43f04b86d266` | Add customer custom fields for CRM create, edit, and detail views. | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `ff488f56a3c7` | fix(registration): simplify customer public form fields | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `145555afd8f7` | Fix unpaid-user billing redirects and seed SYA6KABE promo. | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `a009b6382b36` | Test GA menu path rewrite keeps shared boards accessible | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `8c6999c8a705` | Show GA-only feature notices for unaffiliated users without hiding menus | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `9c89fefe2e70` | Pre-device QA: hooks correctness batch, newsletter useQuery, ops docs drift | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `4056d1b7d67f` | Platform stability: insurance contacts routes split and hooks cleanup batch | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `6afba04c401f` | Backend Phase 2G: extract feature-requests and stabilize hooks | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `cf915de73bb5` | refactor(server): extract background workers from index boot | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `e2e47f6fe492` | test(billing): set payment secret env in auth boundary test | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `9869bc82d002` | refactor(billing): move billing key issuance outside transaction | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `728157448aa7` | fix(storage): enforce consent and signature file ownership | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `bacf457eec59` | fix(storage): enforce consent and signature file ownership | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `22fb44573726` | fix(billing): validate provider payment identity and amount | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `3700c6841b98` | fix(billing): reconcile incomplete provider payments | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `28f797cccf1f` | refactor(billing): move toss charge outside database transaction | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `29802957188e` | test(api): add web native contract regression coverage | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `28dc76b3513d` | fix(billing): harden payment idempotency | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `93b311d4071e` | fix(storage): enforce file ownership before signed url | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `cbbf8b679151` | refactor(auth): extract login and registration handlers | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `d8f94aa45245` | ci(web): run frontend tests in quality gate | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `dcd097c7821e` | chore(ops): add production script safety guards | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `a08bb1bf0474` | fix(ci): provide dummy DATABASE_URL for module imports | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `927801543712` | fix(ci): run server tests serially on CI with failure annotations | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `2627e33e29b4` | fix(ci): batch server tests and enable strip-types on CI | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `57220208bf4b` | fix(ci): use Node 22 for TypeScript test imports | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `81300cf01916` | fix(ci): use cross-platform server test runner | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `8b6069064e12` | chore(ci): sync package-lock for npm ci on GitHub Actions | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `a8a601e58ceb` | chore(ops): classify production scripts and document safety | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `e91424dcffb1` | fix(stability): remove login secret logs and restore test baseline | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `306540c00e59` | fix(auth): align phone-verification credential diagnostics with aligo direct | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `7fcb2eaf9077` | feat(alimtalk): add railway direct provider switch and messaging docs | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `473b31d1b0bb` | refactor(sms): route all insurance sms through railway aligo direct | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `84f9fba1fefd` | fix(sms-ui): show Railway outbound IP allowlist for CRM Aligo | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `88510be95f59` | fix(notifications): avoid qaSafeMode import on develop alimtalk path | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `de9847894e41` | refactor(notifications): disable kakao for customer and claim events | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `8bf2b6f5f02a` | fix(push): allow FCM under QA_SAFE_MODE | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `6eafda676330` | feat(push): extend CRM notification SSOT for native app push | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `603322ecb074` | fix(company-registry): format STAFF contact phone inputs as Korean mobile | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `124555c5a1cc` | fix(billing): honor active free trial entitlement across billing gates | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `b8f66a047529` | feat(billing): clarify cancel-scheduled resume UX on manage page | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `83dee73417df` | feat(billing): rebuild checkout UX as plan-coupon-payment summary flow | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `558504668da8` | feat(billing): checkout quote and discounted charge from promotion SSOT | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3e8852cd7c7e` | feat(billing): subscription manage UI for cycle change and cancel | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `49c6a2caa722` | feat(billing): renew with pending billing cycle on successful charge | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `b0c354cc3210` | feat(billing): pending cycle and cancel/resume subscription APIs | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a3dd2be3a28b` | fix(alimtalk): send UK_2268 button as http absolute URL | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `0832c569de25` | fix(customer): restore workspace UI and follow actual scroll owner | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `2fa23d35a506` | fix(customer): preserve list scrolling across narrow PC breakpoint | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `df8700974594` | fix(customer): preserve list scroll owner in narrow PC windows | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a2affdd0feb7` | fix(customer): center scroll-top FAB within visible customer list | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `7e5e24edda4c` | fix(customer): anchor PC scroll-to-top button to customer list | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3707d9877d0f` | fix(billing): align store review accounts with standard billing | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `65333562c71e` | fix(billing): restore profile billing section for regular users | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3b81ba8ee86e` | fix(billing): hide TEST QA UI on production and isolate credential env | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `c942a5f4aac1` | chore(billing): one-shot renewal script에 development Test-Code seam 추가 | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `db9a1c901e0e` | feat(billing): Toss 월/연 자동결제 renewal worker 추가 (기본 disabled) | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `72be659d2e8a` | feat(billing): TEST QA 전용 단건결제 버튼 추가 (virtual mode 한정) | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `76db7e5a0327` | fix(billing): pending 중복삽입 방지 partial unique index + price SSOT 테스트 | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `b3c0df370a4c` | feat(billing): TEST 단건결제 QA 지원 — testCode 입력 + requestBillingPayment 파라미터 추가 | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `fec0e59b019e` | fix(billing): success URL에서 authKey/customerKey 즉시 제거 + refresh 재실행 방지 | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `7b9f9da0578e` | fix(billing): checkout CTA 중복 제거 및 결제수단 버튼 분리 | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `439b83c1bd39` | feat(billing): 기존 이용자 결제수단 등록 진입점 추가 (register-only) | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `07c8fdc9eef5` | fix(billing): pass registerOnly=false explicitly on charge intent in BillingSuccessPage | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `ab60062e2e51` | fix(billing): restore missing registerInsuranceBillingApi import in server/index.js | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3d5d9f8fe705` | feat(billing): implement Toss Payments auto-billing provider for TEST environment | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `941ad8576929` | fix(customers): stabilize PC list scroll for related customer and top FAB | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `dfbcb784d9c3` | test(alimtalk): expect scheme-stripped UK_2268 button link values | B | QA·테스트·캡처 전용. |
| `df64a84d6805` | fix(alimtalk): align UK_2268 body and button URL contract | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e704db2daa57` | feat(alimtalk): gate UK_2268 send on Aligo APR status | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `8ad84261e375` | fix(customers): unify mobile customer form buttons to FormButton SSOT | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `db0119fe78bc` | fix(customers): wire mobile recent list to customers refresh event | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `62d7f7a38888` | feat(customers): 고객 직접등록 후 최근등록 영역 즉시 반영 | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3c4feeb573e6` | feat(legal): add mail-order business registration number | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `8ef0240bf851` | feat(alimtalk): notify owner when linked customer registration completes | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `dfd628fb6a84` | fix(newsletter): show current GA loss-adjuster posts to users | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `19f70bc07dd4` | fix(navigation): hide unusable menus from GA admins | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `92cdc4a3b475` | fix(customers): preserve form after failed customer save | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `2e4759227223` | fix(billing): provision tenant for new GAs and resolve via systemQuery | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `b06cce4403a2` | chore(deploy): retrigger develop build for GPT guide modal width | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `15f7519c90f1` | fix(profile): set GPT guide modal to 840px shell | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `ba5e094f8fca` | fix(profile): cap GPT guide modal width to ~840px | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `7e8756a36ce8` | feat(profile): add GPT guide for customer Excel conversion | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `9a8aa3fb6111` | fix(authz): align GA admin and staff navigation with permissions | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `3d0dfaaaf223` | fix(insurer-sites): keep card actions inside compact square cards | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `cbcf06bbf8ac` | fix(insurer-sites): keep two-column grid on narrow mobile widths | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `845d6befc93b` | fix(insurer-sites): reduce square card size and increase grid density | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e32956dcec60` | fix(insurer-sites): square cards and remove logo plate background | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `31846b1f5d90` | fix(insurer-sites): insert missing seed rows on boot | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `78fb3f0db782` | fix(insurer-sites): flatten category tabs and add Hana Life logo | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `2c7b4b1b3a51` | feat(insurer-sites): redesign cards and hide compensation links | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `28edfbccc308` | fix(company-directory): update selected insurer instead of inserting duplicate | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a43572d2a77e` | fix(introduction): align install route with landing download section | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `16c086759232` | fix(introduction): finalize responsive landing and inquiry flow | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `56848a528600` | feat(admin): add ONE FC inquiry management | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `2ca936ef9f4a` | feat(inquiry): add public ONE FC inquiry submission | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `7918a26e7eb9` | feat(introduction): rebuild ONE FC landing page | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a5bd3881c6de` | fix(public-board): count delete impact by board id | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `1b50304f571a` | feat(insurer): add Fubon Hyundai Life across company directories | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `b9de1648f4b6` | fix(public-board): unblock startup on duplicate active slugs | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f5e5171ed7b9` | feat(public-board): add safe board deletion | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `ea3860b88074` | fix(public-board): scope writer accounts by board | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `853533929bb2` | fix(billing): expose checkout flow to review tenant | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `6f4c047f459d` | fix(customer-app): show request success dialog and open request list | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `4a85c66f7a9f` | fix(notifications): scope claim delivery outboxes by ga | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `3c2253a6dae4` | feat(alimtalk): send claim received notifications | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `8439fe31ed88` | feat(android): handle claim push registration and deep links | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `6d14ac7882f7` | feat(push): register Android devices and send claim notifications | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `13119731a739` | feat(notifications): refresh claim submitted copy and login deep-link return | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `9fc25362d8e5` | fix(card-payment): align management column and move customer tab last | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `453da8011b10` | fix(card-payment): align compact rows and add policy copy | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `dc6edc6eaf73` | refactor(card-payment): compact forms and customer master-detail | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e9df9e1533cb` | refactor(card-payment): simplify collection UI and unify row actions | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `bd26360a31e5` | chore(download): retrigger Railway develop deploy | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `43450129f010` | fix(download): point Android links to production Play Store | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `2ef856a716e4` | feat(card-payment): add grouped collection workspace and direct card copy | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `b92c3146ce3e` | refactor(card-payment): separate customer cards and collection targets | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d6f91ce75829` | fix(account-vault): restore vertical scroll on shared page | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `b4634c937c25` | fix(admin-user-sms): limit bulk notice to USER role accounts | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `fa4c0a269fe1` | fix(admin-user-sms): drop largeForm preset fighting 720px width | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `74603934e649` | fix(admin-user-sms): repair bulk composer dialog layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `76b3c269898f` | fix(admin-user-sms): allow dry-run without sender number | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `920ff6bf3048` | feat(admin-user-sms): add campaign history detail and harden runtime | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `215d4ee80653` | fix(admin-user-sms): import runtime info from config module | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `18fcae4e482b` | feat(admin-users): show contacts and bulk SMS composer | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `b4bfa8555afe` | feat(admin-user-sms): add CRM user bulk notice campaign api | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `9bf4cc91adf2` | fix(memo): strengthen textarea focus background | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `7a1e77e6f4e0` | fix(forms): restore shared single-line control height | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `6864ec056972` | fix(premium-payment): ga-scope owner load and one-time reveal grant | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f3d57d86ed96` | feat(premium-payment): add customer and global payment UI | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `115892b8e4bc` | feat(premium-payment): add encrypted customer payment records | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `6ac63352c113` | fix(memo): let textarea fill resized memo card | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `284a848fd708` | fix(newsletter): isolate dynamic board posts from insurer feed | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `1edac434c98c` | fix(newsletter): show board writer name on posts | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f7d91e1390a4` | refactor(newsletter): reuse shared account form in writer panel | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `353b2cd0802c` | refactor(newsletter): add shared board permission policies | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d1c9632e3cb5` | refactor(newsletter): align loss adjuster with ga boards | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `8a39ac937c6d` | feat(news): make adjuster newsletter configurable by ga | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `977f2a198d90` | fix(legal): add reliable navigation to standalone policy pages | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `ce234a16bf33` | fix(customers): compact mobile map customer panel | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `bfa2a39e5987` | fix(customers): refresh map markers after customer recenter | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `017385aaaa33` | fix(customers): keep map recenter enabled outside viewport | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `9cbfa7ec2c8e` | fix(customers): use login id as referral code | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a62d2c132216` | fix(customers): close map customer panel correctly | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `b9404bf99234` | fix(customers): enable selected customer map recenter control | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `97cdd196bc99` | fix(customers): add selected customer map recenter control | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e2bc1ac07e43` | fix(customers): reuse full customer map logic in detail view | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d161d3f491a2` | fix(customers): show selected customer map in detail workspace | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `0b16a963679c` | fix(customers): show weekdays across consultation dates | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3f582b2dc4ba` | fix(customers): show weekday and space consultation actions | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `9c3d167b77ce` | fix(customers): align consultation history layout with detail page ui | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `ceca0627c371` | fix(alimtalk): log emtitle passthrough on EC2 relay | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `08c21f295f5a` | fix(alimtalk): switch registration template to UJ_6670 | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `4b0502d4ba39` | feat(customers): add transferred customer inflow source | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `1d9fe1eafff5` | fix(forms): keep radio and checkbox controls compact | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `9453a829ef96` | fix(ui): align todo and claim fields with form styles | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d40824ced630` | fix(customers): include birth date in family member details | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `00f8543929f7` | fix(customers): keep family member search usable for large groups | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `76f2a0120b9e` | fix(customers): show gender and birth date in family group | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `22c14e0c1d19` | fix(customers): preserve detail state after relation group changes | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `918f0eaf428d` | fix(customer-app): close connection modal before android back | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `8a902be3b3ab` | fix(customers): compact relation group ui and reuse search list | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `ad2be5c59607` | fix(customers): restore phone input padding in link modal | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `95a321842eb9` | fix(customers): repair relation group persistence and legacy modal ui | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `da901f68cd66` | fix(customers): keep legacy relations separate from family groups | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `533dd0af694d` | fix(customers): add searchable relation members and custom labels | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `921b4949634f` | fix(alimtalk): align Kakao accept path with approved templates and EC2 relay | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a172fd3b5fc9` | fix(customers): restore related customer open handler | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f1e9adbef3b3` | chore(alimtalk): detect camelCase senderKey in profile diag display | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `365f85d5b977` | fix(alimtalk): match Aligo profile senderKey camelCase and document live EC2 path | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e9bb42436880` | fix(alimtalk): route kakao send via ec2 gateway for ip allowlist | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `665069ba9ca3` | feat(customers): add grouped linked customers | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `af9a2e305079` | fix(customers): close link share modal on android back | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `282563595a1d` | fix(customers): align link share modal with app ui rules | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f8ccc7fbd04c` | fix(news): show ga newsletter menu name without suffix | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `8357c4e628f5` | fix(ui): replace native dialogs with app modals | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `94e3ace356b0` | feat(customer-app): add send modal with prefilled customer phone | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `27573d76ed75` | chore(alimtalk): document and wire required environment variables | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `065f5f5bf441` | fix(customer-registration): rename share label to send | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `658860bb283d` | fix(customer-registration): use user aligo settings for sms share | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `9fce03f882f2` | fix(forms): auto-format phone and resident number inputs | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `801349d0fad0` | feat(alimtalk): add registration link share actions | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `2ab43036bbbe` | chore(alimtalk): wire customer app template code | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `f50e06292dea` | feat(alimtalk): send customer app link notifications | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `7d330609605d` | fix(todos): show weekday in created date column | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a0430db3d088` | fix(alerts): open settings and compact notification panels | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `7dcdbf592c11` | fix(todos): simplify task form and list display | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `7dfadd65b238` | feat(alerts): add configurable notification settings | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f7c0af1a8f2d` | fix(customer-app): improve header action contrast | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `728fc83fba88` | fix(customers): keep GA product column wide across visible columns | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `4e581bbf897a` | fix(menu): hide customer detail signature tab | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `735ec39d8ab5` | fix(customer-app): prevent linked customers from editing master profile | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `0027181f1f02` | fix(login): simplify download links | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `052935b06c8b` | fix(menu): keep customer management submenus visible | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `bd5c8d9fd732` | fix(menu): hide unused user signature and claim entries | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `96d366b61d54` | fix(alerts): show only upcoming insurance age dates | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f7e43f014898` | fix(legal): update public business information | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `7a3858e6aaf8` | feat(sms): unify variable insertion across message flows | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `9fc661248a35` | refactor(sms): unify message composer and phone preview | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `541514f20dcb` | feat(sms): simplify automation preview workflow | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f35a8b1232f4` | fix(build): sync floating-ui lockfile dependencies | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `6b5bb7c9a738` | docs(sms): improve aligo setup guidance | B | 문서·CI·운영 가드. 제품 런타임 변경이 아니다. |
| `ce2c11a29b5c` | fix(newsletter): unify delete actions in shared viewer | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `925ff015f312` | fix(newsletter): use board writer auth for link previews | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `00501c56e75f` | fix(newsletter): import link preview normalizer in board writer | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `95eac0d7ed46` | fix(newsletter): render saved link previews in shared viewer | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f201319988c8` | fix(newsletter): mount link previews in shared news viewer | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `711a5dac6ceb` | test(viewer): assert dynamic board detail uses modal viewer | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `ac33d2549ee4` | fix(newsletter): allow diagonal panning while zoomed | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `dbea6ca1daf3` | feat(newsletter): add auto links and link previews | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `e8257d260bad` | fix(requests): populate legacy request_id on comments | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `9abea421730d` | fix(requests): allow admin comments and show author names | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `1baad07f2831` | fix(sms): normalize automation run item dates | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `35e25ac86ccf` | fix(sms): skip dedupe insert on simulated automation runs | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `26bb6236d3b1` | feat(sms): add automation execution pipeline | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `85f6b0d40bb9` | fix(sms): align automation page navigation layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `519065cd894a` | feat(sms): reorganize message module navigation | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `5b99c7ed1c24` | feat(sms): improve message workspace previews | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `95f9206472a5` | feat(customers): add sms opt out preference | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `101dbcae2b61` | feat(sms): add automation target scope filters | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `efe685acef34` | feat(sms): add automation variable buttons | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `5746a8ece37d` | feat(sms): add automation preview dry run | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `5e14b9b4c79f` | fix(customers): apply GA excel header detection to all imports | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `dea208f506df` | feat(sms): add automation rule settings | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `8888f4040a20` | fix(company-registry): show only global latest contact changes | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `98d792e17e76` | fix(customers): repair special date form inputs | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `6a5d879c8c63` | fix(company-registry): refine latest change highlighting and GA data formatting | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `817f634e6ca1` | feat(customers): add customer special dates | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `16ac003f64f3` | fix(company-registry): restore contact row alignment in cards | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `4064468a2749` | fix(company-registry): cap contact cards at 4 columns and tighten top spacing | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `bf022058185b` | fix(newsletter): align board-writer workspace with light theme | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `18c88885129e` | fix(customers): align GA data grid columns | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a6167b9a00ab` | fix(newsletter): zoom around viewer center | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a30ddae71622` | fix(newsletter): hide empty text placeholders for image-only posts | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `292f46da651c` | feat(newsletter): expose GA board menus to staff | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `38947ef7e6c6` | feat(company-registry): show contact changes inline | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `be4cd99d4923` | fix(customer-app): align attachment list with light theme | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `c0691bde787f` | chore(deploy): trigger sms-scheduler deploy on develop HEAD | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `2926792f2386` | chore(deploy): stop railway.json startCommand overriding per-service workers | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `5926bd11385b` | fix(sms): use full unique index for scheduled delivery upsert | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `60eaaaecf031` | fix(sms): escape cron comment in scheduler entry script | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `dd90150c1275` | feat(sms): add persistent sender worker for scheduled sms | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `012e91e393c4` | fix(customers): improve vehicle date and year inputs | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `57ee08a36bc7` | fix(ui): restore calendar picker for normalized date input | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d51f9ef753da` | fix(ui): normalize date input to YYYY-MM-DD with 4-digit year cap | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `bc829674080d` | fix(sms): enable scheduled save when group and sendable targets are set | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `2102d71781d9` | fix(sms): toggle bulk person row on full row click | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f08b385f5e2f` | feat(customers): add mobile carrier select field | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `26557820e2c8` | feat(customers): split medical history notes | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3172971d2a42` | fix(auth-sms): align verification SMS with CRM gateway contract | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `c7ca8bc025ae` | feat(introduction): split mobile downloads by platform | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `659a50f4b953` | fix(auth): require real SMS dispatch for signup verification | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f58ec7531704` | fix(sms): balance person row column spacing in groups list | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `2173983e3a2d` | fix(sms): tighten group row grid and split template save actions | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `a84794811aac` | fix(sms): separate template editor preview layout | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `4392c59f97c1` | fix(sms): unify person rows and expose templates tab | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `44661c1ca986` | fix(sms): unify contact row layout and phone preview | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `391637704b86` | fix(layout): restore desktop submenu styling in snap width | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `6879eae8dba6` | fix(layout): restore PC menu styles above 1024px for snap fix | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `c63905f9c903` | feat(ta-call): add weekly summary card | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `fb273980e8c5` | feat(sms): unify bulk rows and add template management page | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `74298a1317d7` | fix(contacts): responsive PC card grid and center mobile labels | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `ff4bac0dfd5e` | docs(rules): add PC snap responsive menu SSOT | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `eab072686f13` | fix(layout): keep PC navigation visible in snapped windows | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `18402df8a818` | fix(contacts): restore mobile contact rows and align labels | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f36313b397a8` | fix(sms): prevent repeated group member fetches | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `ac6144a51147` | fix(sms): correct group selection rows and send preview | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `939dcfd536e8` | fix(sms): normalize group rows and send preview layout | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `e28ac278c58b` | fix(sms): refine group rows and send workspace UI | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `201403ed2d16` | feat(sms): reorganize messaging menu workflow | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `48586296dd84` | fix(sms): align bulk rows and template preview UI | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `6a2eb3794fab` | fix(sms): widen content area and fix layout overflow issues | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `53acfaadb1d1` | fix(sms): restore bulk and scheduled three-column PC layouts | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `4e4f23212b5d` | feat(sms): constrain content width and add template view/edit UI | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `64a63fd8acfc` | feat(sms): add scheduled message workspace UI | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `d4fa73f60d09` | fix(ui): prevent backdrop dismiss for confirm and input dialogs | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `8e64c3a05720` | fix(account-vault): confirm before deleting account credentials | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e3c3ee05efb9` | fix(account-vault): prevent action button label wrapping | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `6d79573ac0db` | fix(account-vault): standardize account row action buttons | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `c56c4e5445f9` | fix(account-vault): move general account add action to header | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `4ead93f98733` | fix(account-vault): compact personal account header | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `c3147a17aa49` | fix(account-vault): enforce shared category restrictions on server | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `69b0a2511c92` | fix(account-vault): tune shared account section width | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `477c47758a13` | fix(account-vault): cap shared two-column section width | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `4f6c8e427322` | fix(account-vault): widen shared two-column account sections | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `98c1aed8ee97` | fix(account-vault): limit shared account categories and polish search input | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `917c494f83e1` | fix(account-vault): compact shared account workspace layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `80fcbe50c865` | feat(account-vault): add split shared account workspace layout | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `13386d3f843f` | fix(account-vault): polish shared account list UI | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `b02eebe6be0c` | fix(account-vault): polish shared account list link UI | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `513e1f87913d` | feat(account-vault): add public shared account list link | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `3941c0f8c303` | fix(menu): restore role navigation while keeping shared account access | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a5f835667768` | fix(router): restore ProtectedRoute import for login page | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d855170ff555` | fix(menu): simplify GA admin and staff navigation | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `84974518b20e` | fix(account-vault): show shared users for GA staff list | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `0e482a5873f7` | fix(contacts): align mobile company contact rows | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f3a0ccb9a1aa` | fix(account-vault): resolve share-visibility PATCH 400 route shadowing | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `dedc385a7591` | feat(account-vault): add staff shared account management access | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `6df1eeccbb5a` | fix(sms): 단체문자 선택 대상 카드 compact 고정 + 문자 보내기 탭 정리 | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `260a2a6f0f77` | fix(account-vault): 접속 URL 새로생성 전 확인창 추가 | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `4dda678fcbc5` | fix(sms): 단체문자 고객 찾기 초기화를 조건·결과 비우기로 재정의 | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `d7b4d106b56d` | fix(sms): 단체문자 고객 찾기 초기화 시 stale 응답이 결과를 덮는 문제 수정 | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `e2b9c75dfb86` | feat(customers): 고객정보에 계좌번호 필드 + 복사 버튼 추가 | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `ccd3b9a01818` | fix(sms): 고객 찾기 초기화 시 검색 결과/카운트도 함께 초기화 | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `76bfff60d6bf` | feat(insurer-news): 소식지 soft-delete 삭제 기능 추가 | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `50ae7ec8fd59` | fix(sms): refresh search on reset and stop group list stretch | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `e4453725001f` | fix(sms): prevent group rows from stretching | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `6f69a837f101` | fix(sms): compact module topbar and provider notice | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `4eed16ff24da` | fix(sms): compact recipient group rows | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `2ee5186b7069` | fix(sms): dedupe bulk recipient search results | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `3839e0dbcda8` | fix(sms): apply recipient search and eligibility filters | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `3e17d9de10dd` | fix(sms): compact bulk recipient lists and selection controls | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `48c1fb20bedd` | feat(sms): add bulk recipient group workspace | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `20ef3ed4ef52` | feat(ta-call): add target filters to daily assignment settings | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `968d40ea74a2` | feat(sms): 단체문자 대상 선택·그룹 저장 및 발송 스냅샷 | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `0eb22142ead2` | fix(ta-call): move TA menu under task notifications | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `619774e41454` | fix(ta-call): open customer detail from assignment name | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `64c2c741d505` | fix(ta-call): refine weekly section display and customer formatting | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3af7c10a11a5` | fix(ta-call): create assignments only for today in weekly view | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `51da4fa0607e` | fix(ta-call): allow unscoped safeQuery for user-scoped TA tables | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `80ceb91558b0` | feat(ta-call): add daily TA call assignment workflow | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `38828d0e4a33` | fix(customers): prevent mobile reset from shrinking scroll fab | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3d2fce52110a` | fix(customers): tune mobile scroll fab shape | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `771d089b7863` | fix(customers): refine mobile floating action placement | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `0f7a8e7073cc` | fix(customers): align recent and scroll floating actions | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3f5c9c9b1893` | fix(customers): tune mobile floating actions | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `8ed1d83ef90c` | feat(account-vault): add share link preview meta | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `08c5425152a5` | fix(app): separate Android and iPhone install links | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `6c9416199813` | ﻿fix(customers): keep list scroll button visible | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `6082a1b7899c` | ﻿fix(customers): add list scroll to top button | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e5f01b8d3c81` | ﻿fix(account-vault): show external link status | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `7e3dcad9c70a` | ﻿fix(storage): align personal storage with file explorer UI | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `6c6022adf76a` | fix(account-vault): compact external link actions | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d815fc74ca01` | feat(account-vault): add external edit link | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `bc525b184db1` | fix(pdf-engine): unify compact coordinate editor height | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d9815d28d9ce` | fix(sms): use configured ad display name | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `96110dee9fcc` | fix(pdf-engine): align coordinate editor compact layout across templates | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `a34d8250ed57` | fix(sms): tune phone preview width | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `de388b04868d` | fix(insurance-claim): simplify coordinate editor helper text | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `aecfce2ab59f` | fix(insurance-claim): align coordinate editor panel heights | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `dfe50a6b35bf` | fix(insurance-claim): restore three-column coordinate editor layout | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `1dbec90e9145` | fix(sms): simplify phone preview rendering | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `dee3efa4a65e` | fix(insurance-claim): widen admin document coordinate editor layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f943d968033c` | fix(insurance-claim): restore admin insurance company settings menu | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `2fa0ff7a28db` | fix(sms): simplify composer preview experience | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `8d71588a0e7a` | fix(sms): stabilize composer preview width and substitutions | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `4930d1b74224` | feat(sms): add message composer preview | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `60c840f91216` | fix(sms): simplify aligo settings UX | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `cf285a93e7f0` | fix(sms): block test sends when real send is disabled | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `cc6e74cbc906` | fix(appstore): auto apply launch promotion and hide billing flows | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `c6eb68936c58` | fix(sms): pass auth token to sms api requests | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `b5f3448b1d2d` | fix(sms): align module UI with light CRM theme | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `e89da201aa50` | fix(sms): align client routes with backend api prefix | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `67b4078ca993` | ﻿fix(sms): handle empty settings response safely | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `adb54c025ab4` | fix(sms): allow gateway provider in production runtime policy | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `bbf673ed38ca` | feat(sms): add hardened aligo CRM messaging module | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `97a0046d1dcd` | fix(insurance): show correct app review account display name | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `9c2f14f45ae1` | fix(insurance): remove desktop claim request inner scroll | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `7ca4cfe745b1` | fix(insurance): refine claim request detail layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `c1e8dd1b1e08` | fix(insurance): align folder create controls vertically | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `472b6e4183e7` | fix(insurance): align folder create input and actions | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `0d1aa9eeb7a1` | fix(insurance): polish folder create modal spacing | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `774705951993` | chore(review): support Apple App Store review account provisioning | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `59310a918ee8` | fix(insurance): define contact copy status state | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `b8fa0c8dec82` | fix(insurance): replace contact copy alerts with inline status | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `51e34881747f` | fix(insurance): restore desktop account credentials layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `03f7fa265308` | fix(insurance): correct claim company panel corner styling | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `5c5eb233d854` | fix(insurance): restore contractor same as insured control | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `2f6583208005` | fix(insurance): align claim insurer picker with form top | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `28cda4e3ad27` | fix(insurance): render claim form fields from template coordinates | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d5362d006090` | fix(insurance): align claim form layout with account management style | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `7996830f947e` | fix(insurance): use single insurer selection with editable claim fax number | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `dd7cf83eae42` | feat(insurance): support multi-company claim requests | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `dbc5a807b955` | feat(insurance): support multi-select grouped insurers in claim form | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `844f32859ea0` | fix(insurance): restructure insurance claim form layout | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `c1ae28542c95` | fix(insurance): compact insurance claim page layout | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `ca3f47837e77` | fix(insurance): polish insurance claim pages UI | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `3cbce894e0a6` | fix(insurance): remove nested notice editor card styling | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `8402852dad90` | fix(insurance): improve subscription status badge readability | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3f8cfa28006e` | fix(insurance): simplify admin analytics and show user subscription status | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `33725cd8138d` | fix(insurance): make audit logs human readable | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `01df09c84611` | fix(insurance): group admin menus and hide claims from non-users | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `ed9a5aa002e5` | feat(insurance): allow deleting signature request history | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `e3b5680a9653` | fix(insurance): apply alignment to notice link preview cards | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `b403b9ed59b6` | fix(insurance): align notice editor embeds consistently | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `0068678e279e` | fix(insurance): resolve duplicate notice binding in setAdminNoticePopup | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `29efe6806b8b` | fix(insurance): show active admin notice popup and enhance editor embeds | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f5a8898ee681` | fix(insurance): stabilize admin notice editor save and uploads | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3c857d7bab4e` | fix(insurance): replace notice block editor with rich text editor | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `1c04bb110c85` | fix(insurance): correct admin notice route exports | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `eddf5a0f278a` | fix(insurance): restore notifications api registration import | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `333118bb194c` | feat(insurance): add admin notice popup management | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `285d064ec057` | fix(insurance): restructure account credential rows | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `ffea0e282091` | fix(insurance): improve mobile account credential layout | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `62d51cf9d515` | fix(insurance): recalculate memo board bounds when list collapses | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `ca509af44f94` | fix(insurance): close mobile memo editor on android back | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `132281868ede` | fix(insurance): adjust mobile memo editor action placement | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `874f3e10d616` | fix(insurance): replace mobile memo board with list and fullscreen editor | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `96269d7a9d59` | fix(insurance): add general account section and compact account layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `1972067bc515` | fix(insurance): align claim download zip filename test | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `81f9705cef24` | fix(insurance): expand mobile memo canvas horizontally | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `f82f0d0295b4` | fix(insurance): route new insurance assets under insurance storage prefix | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `34f5f9316137` | fix(insurance): allow mobile sticky memo canvas expansion | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `75a760695057` | fix(insurance): format todo due dates in Korean style | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `9c090fe9e0ed` | fix(insurance): navigate to notifications page from bell icon | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `adf8faa10c4b` | fix(insurance): enforce white notification theme and limit age alerts to 30 days | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `1eb271d1c606` | fix(insurance): confirm before marking notifications as read | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `10669718dbe3` | fix(insurance): simplify notification panels and confirm workflow | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `de93106c78ef` | fix(insurance): dedupe renewal notifications at database level | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `2912e000e3f1` | fix(insurance): show d-day labels for notification target dates | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `499fdc4c597c` | fix(insurance): keep due renewal notifications until completed | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `58e933a1e9e7` | fix(insurance): hide minimized sticky memos from board | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `4b55d977eaf2` | fix(insurance): align insurer account save button with primary style | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `ca44540d3edc` | fix(insurance): polish sticky memo controls and toolbar | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `72a65ba0910b` | fix(insurance): align insurer account table columns | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `a132c3726524` | fix(insurance): improve sticky memo drag UX and design | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `e6ffdeb1a848` | fix(insurance): polish insurer account table alignment and add copy actions | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `959629405c31` | fix(insurance): render sticky memos on memo board | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `6a064afeced5` | fix(insurance): polish insurer account management table layout | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `72f8eae6da92` | fix(insurance): render sticky memos on memo board | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `a61dea179faa` | fix(insurance): improve insurer account management layout | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `f356bd43fa50` | fix(insurance): restore sticky memo board layout | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `76d799fd48aa` | fix(insurance): fix notification center errors and filters | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `5a5519b02951` | fix(insurance): align new utility pages with white theme | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `b96ce6159695` | fix(insurance): harden notification sync against schema drift | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `d0e10d3a257b` | fix(insurance): avoid customer_cars.sort_order in notification sync query | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `cc9225f6237b` | feat(insurance): add user insurer account management | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f2484b4af313` | feat(insurance): restore sticky memo board | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `426867ccf51c` | feat(insurance): add user notification modal and center | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `93c0f318770d` | feat(insurance): add delete for insurance claim requests | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `ddda4ea62329` | fix(insurance): scope insurance claim list to current user | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `73907ae86348` | fix(insurance): constrain GA upload preview horizontal scroll | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `4189377d31bd` | fix(insurance): show all customer files in explorer root view | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e830c9e2156a` | fix(insurance): improve GA data upload preview actions | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `11ab0f54c9a6` | fix(insurance): scope claim requests to owning user | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f9c2161ad9d1` | fix(insurance): infer gender from resident number on customer import | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `c5579014f53c` | fix(insurance): allow customer import with phone or resident number | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `120db5da8d10` | fix(insurance): relax customer import limits and required fields | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `50b13145be44` | fix(insurance): remove customer import row limit | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `15968a5f3570` | fix(insurance): align customer file explorer action buttons | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `05ceb4197668` | feat(insurance): add referrer name field for introduced customers | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `da20dc47b3bd` | fix(insurance): finalize customer file explorer root label | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a158919ac345` | fix(insurance): refine customer file explorer toolbar layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `b1ebc4208d06` | fix(insurance): polish customer file explorer layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `5538da5b719f` | feat(insurance): add explorer layout for customer files | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3ad8ba13821a` | fix(insurance): normalize displayed dates to korea timezone | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `b3de6aa37376` | fix(insurance-claim): generate separate consent forms per claimant role | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f1afbe08ea3c` | fix(insurance): scope feature request comments by ga | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `9100529e31a3` | fix(insurance-claim): preserve contractor snapshot in UI save/generate path | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3f6185223d5d` | fix(insurance-claim): resolve legacy customer attachment keys in ZIP downloads | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a2eaf7d0fcc8` | fix(insurance-claim): fix claim form initialization and attachment downloads | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `26422fabb583` | fix(insurance-claim): complete claim attachments signatures and PDF mapping | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `b407c2cb78b5` | fix(insurance-claim): expose claim pages in main menu and align light theme | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `1f0f5c8a30cd` | fix(insurance): keep customer workspace context for signature tab | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `4db887f78693` | fix(insurance): simplify claim detail preview typography | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `21a71ffcb60c` | fix(insurance): unify claim management detail UI and status colors | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `743444b9634d` | fix(insurance): align claim request open button and card UI | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `2454966688c1` | fix(insurance): polish embedded customer claim request layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `1a0b60bab23e` | feat(insurance): allow editing shared newsletter board metadata | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `77c8aff0f967` | fix(insurance): route claim inbox customer link to selected claim workspace | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `ce8536adcdcb` | fix(insurance): skip incompatible claim request creator foreign key | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `db65ae444214` | fix(insurance): route claim preview customer link to internal claim section | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `914235099641` | feat(insurance-claim): add attachments signatures and zip download | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f354ecfcc951` | feat(insurance-claim): connect mobile claim entry point | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `dd752b9fcff4` | feat(insurance-claim): connect customer claim entry point | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `7a71d2533362` | feat(insurance-claim): download generated claim packages | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a98a6c6b00bc` | fix(insurance-claim): remove duplicate generator import | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f326daf0389a` | feat(insurance-claim): generate company claim documents | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `b59cff6679d9` | feat(insurance-claim): resolve claim document field values | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `079d06c75794` | feat(insurance-claim): add claim history duplication | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f702903c83a5` | feat(insurance-claim): add manual claim request form | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `78c046ec70ae` | feat(insurance-claim): add claim request persistence | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `41c737460441` | fix(insurance): collapse same-day contact history by company | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `8ce99a83069c` | fix(insurance): show company registry save confirmation inline | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `216549840421` | fix(insurance): preserve staff input order in contact history | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `00b6945a408b` | fix(insurance): replace company registry save alert with inline status | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `0ae6a508bc16` | fix(insurance-claim): correct merged PDF buffer upload for claim documents | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `43a131ca8588` | fix(insurance): highlight contact history changes and add back navigation | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `36eb5aef915e` | fix(company-registry): log post-save input focus failures | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `2375e07c9527` | fix(insurance-claim): correct claim API module imports | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `348911cb7545` | fix(insurance-claim): log post-save input focus failures | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `bafa1acf596d` | feat(insurance-claim): add admin insurance company claim settings | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3e3ccc6db819` | feat(insurance): add account deletion request action | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a2d11c40ab30` | fix(insurance): align application form page content spacing | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `714961fd34dd` | fix(insurance): align pc customer default section and mobile todo selection | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a29e91139bd7` | fix(insurance): open consultation history from todo customer links | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `5c9218d0a3bc` | fix(insurance): lighten customer copy success feedback | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `68defb4b7a54` | fix(insurance): polish customer app personal messages and modal back handling | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `be688e0a5eee` | feat(pdf-engine): merge multiple PDF uploads into single template file | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f363b63d4da4` | feat(insurance): show secondary data labels and configure form input order | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `07a9cfa1cc00` | fix(insurance): resolve global input focus lock after submit | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `139d5c80ad29` | fix(pdf-engine): hide unchecked checkbox preview outlines | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `7f67362e32c5` | feat(pdf-engine): add B customer slot flag for field mapping | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `ed78922d069d` | Revert "feat(pdf-engine): add data groups for PDF field mapping" | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `52413d456236` | feat(pdf-engine): add data groups for PDF field mapping | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `e356b1bb250e` | chore(mobile): prepare iOS App Store EAS config for ONE FC | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `4ac711b134d2` | chore(mobile): align Android package with ONE FC Play Console | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `76f7220615a2` | fix(customers): standardize edit footer action buttons | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `dc1105f8f16b` | refactor(insurance): standardize mobile action buttons badges and linked customer chips | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `719718f390a5` | fix(insurance): resolve root layout issues in mobile customer relation modals | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `bcf1f5e98228` | fix(insurance): polish mobile file and linked customer modals | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d638409a9ba7` | fix(pdf-engine): add checkbox coordinate stamping | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `588a6c517ba1` | fix(billing): align payment colors with design tokens | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a325cd2f5483` | fix(billing): align manage panel colors with design tokens | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `7df6585604bd` | fix(profile): align account page styles with design tokens | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `6bdd154f1011` | fix(profile): align account page colors with green theme | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `c8bc3b1cd3ae` | fix(profile): polish account management layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `1ed404de422f` | fix(auth): refine mobile login footer spacing | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `529682b45656` | fix(legal): restore scroll on account deletion page | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `cfccaabed2f8` | feat(legal): add public /account-deletion page for Play Console | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `4b7be41e3f44` | fix(auth): PC login privacy link and profile scroll layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e3555c9d472b` | fix(legal): update privacy policy address and business registration | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `b9193f492ecd` | fix(legal): add ONE FC privacy policy contact details | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `fc7eb55e77e9` | fix(insurance): remove duplicate mobile billing badge | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `fdfb53e047f0` | fix(claims): lock pdf page layout to post-rotate image size | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `0ee8a38518f0` | fix(claims): choose pdf page orientation after image rotation | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `479e4f80517f` | fix(claims): preserve bundle filenames and image orientation | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `ec004cb2f112` | fix(claims): name attachment bundles by customer and date | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `432f05b1d61c` | fix(claims): unify attachment download actions | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `eb1d3452bae0` | fix(insurance): limit promotion redemption to once per user | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e829eb1c84d1` | refactor(insurance): align billing admin pages with shared admin layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `5eb57fc3ed4e` | fix(insurance): polish billing admin UI and status badge colors | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `344e47f1b8f4` | fix(insurance): show user billing status and payment history | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `0ce8f3b37580` | fix(insurance): allow payment request for subscription-assigned plan when inactive | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `44a5b574cc25` | feat(insurance): add billing payment approval and user status badge | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `ddae08bb79fa` | fix(insurance): persist free promotion before showing billing success | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e4cf7685fc7b` | fix(insurance): render billing pages inside authenticated app layout | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `c1010c826ef3` | fix(insurance): stringify admin billing promotion request bodies | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d9d55af67930` | fix(insurance): polish billing plan edit modal | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `27acbf2b0858` | refactor(insurance): unify billing promotion code management | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e56a356d327f` | feat(insurance): add free-months promotion option to admin UI | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3bca196205c8` | fix(insurance): allow pending users to load billing checkout summary | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `c4c00792c154` | feat(insurance): add soft delete for billing promotion codes | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e14864e922fd` | fix(insurance): allow entitled users to view billing checkout directly | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a542bb883fad` | fix(insurance): make billing subscription status migration legacy-safe | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `2ddd1b1d3f31` | feat(insurance): add billing phase 1 checkout and entitlement flow | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `0a50224b09f4` | fix(newsletter): remove extra dynamic board page spacing | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `db251da2a04a` | fix(newsletter): align dynamic board list layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a5bd74983356` | fix(newsletter): polish viewer actions and writer logout redirect | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `92015904a3c8` | fix(newsletter): use shared viewer for dynamic board posts | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d810cdfbe383` | fix(newsletter): scope dynamic board slug lookup | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `70d45f687541` | fix(newsletter): align board writer navigation | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `0aa337ed57e9` | fix(newsletter): allow common board access for public and GA users | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `348fb93375eb` | fix(newsletter): simplify board writer account panel | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `1c75a00e2dc1` | feat(newsletter): add board writer accounts | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `f28465fbc4cd` | fix(web): improve introduction install download button styles | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a3a4625977b9` | fix(desktop): include release notes formatter in packaged app | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `c3b992fcf9ea` | feat(web): improve insurance introduction feature showcase | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `213ffbf6114d` | feat(web): add insurance CRM feature showcase to introduction page | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `01c8f3b6fbec` | fix(desktop): separate shell updates from web refresh updates | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d6e8ec598abe` | fix(customers): maximize customer map viewport | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `20ed81faaa78` | fix(web-update): align mobile update banner layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e4d69115eacd` | fix(customers): route card signature actions to send page with customerId | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `7ed5c2f7e1ed` | fix(navigation): correct customer news focus and pin desktop submenus | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `de65ba9d5556` | fix(desktop): restore refresh-based web updates | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `9786ce258220` | fix(billing): repair promotion stats and activation toggle | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `8b7a5e8565af` | fix(billing): ensure promotion code audit columns | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `9bdaf43af82b` | feat(billing): generate unique promotion codes | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `a5948f667782` | style(billing): align promotion code form layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `6de1cc4d93b5` | fix(viewer): restore vertical scroll in mobile news detail | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `0664da51d9ca` | fix(viewer): allow touch vertical scroll in mobile news detail | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `92b65364e8a9` | fix(customers): import customer merge helper | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `566730205cda` | fix(customers): keep customer card open after update | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `b82ac7d22f1f` | fix(access): show GA-only notice for public accounts | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `f4eb3f534b58` | fix(viewer): enable pinch zoom on mobile news detail pages | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `3c79837683c4` | fix(newsletters): align global writer boards with existing newsletter flow | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `9f5c56323436` | fix(viewer): support mobile pinch zoom for newsletters | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `6eb4cea1af38` | fix(newsletters): allow admin global newsletter board management | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `85a74bd165af` | fix(viewer): keep modal size fixed while scrolling content | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `fd135fb76e03` | fix(customers): remove added public registration forms correctly | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `8da325d24bd6` | fix(viewer): stabilize modal scroll and zoom behavior | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `0042accbdf35` | fix(applications): extract shared document preview modal actions | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `cfddce8f9210` | fix(customers): always open public registration links in form mode | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a2c708b681c8` | fix(mobile): hide map button on customer detail sections | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e206b11a3a03` | fix(customers): persist public registrations on submit | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `ca1ad56cec67` | feat(customers): support multiple public registrations before submit | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `b7d1827d6988` | feat(claims): add bundled claim file downloads | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `386ffdf6dcc3` | fix(customer): improve signature navigation and public registration flow | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `8b1895a84de5` | fix(mobile): build user APK from apps/mobile login entry | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e01d42944b8f` | fix(customer-mobile): regenerate ONE FC launcher icons for user APK | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `04eea9f9691d` | fix(electron): apply ONE FC icon to Windows installer and shortcuts | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `1018ad21517f` | chore(assets): unify ONE FC icons across web, electron, and expo | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `90df5c884e83` | fix(pdf-templates): preserve customer mappings during init | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `403d7147200d` | chore(brand): update app name to ONE FC | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `bce9283ee77f` | chore(assets): update app icons | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `7f76c0c8e417` | chore(referrals): add guarded referral repair tooling | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `4315431ed699` | fix(contract-signatures): improve template modal layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e1a88b173b38` | feat(admin-menu): expose PDF, signature, and newsletter admin for GA roles | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `780f86adc58c` | fix(pdf-engine): restore PC application documents list content padding | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `10633782ea73` | fix(user-ui): extend mobile content gutter SSOT to claim news and pdf forms | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `43b483c253bf` | fix(user-ui): unify mobile user content gutter to customer list SSOT | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `d42325273d04` | fix(insurer-news): allow scoped newsletter board visibility query | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `ea8bf2466bc9` | fix(insurer-news): correct board writer auth import path | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `64320f9803b6` | fix(insurer-news): align mobile detail content padding | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `0f2feab62114` | feat(insurer-news): unify boards into system/global/ga model | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `354660921ea0` | feat(billing): add promotion code management | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `b9643d615db0` | fix(insurer-news): explicitly restore newsletter list grid padding | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d008184b9ca1` | fix(insurer-news): restore newsletter card content padding | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `72cd2df33ed8` | fix(insurer-news): scope list search flex off filter row | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a313e6c470ad` | fix(insurer-news): collapse newsletter searchbar spacing | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `326ddf076b5e` | fix(insurer-news): tighten newsletter list spacing | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `5329843585e2` | fix(newsletters): remove list subtitles | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `0fe704de5c2e` | fix(newsletters): tighten list spacing and light message editor | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e6c5aa164637` | fix(pdf-admin): allow editing template ga scope | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `e73dfaa01674` | fix(mobile-ui): show real notifications and align pdf actions | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e0b23b01a05f` | fix(mobile-ui): align map news and admin screens | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `344ec48afc4d` | fix(newsletters): remove duplicate board SQL import | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d50c88181233` | feat(insurer-news): separate board menu scope and public board writers | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d1bae681da20` | fix(insurer-news): scope newsletter board admin queries | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `2b58cd278a79` | fix(access): restrict ga-only menus for public accounts | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `7504bc2395cc` | feat(insurer-news): add dynamic newsletter boards | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `cb74ca91abab` | feat(insurer-news): add newsletter search | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `a0f1f470966f` | fix(customers): stabilize card search and related UI | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `22a0354fc773` | fix(customers): stabilize card search and map layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `36fe4d5fcbab` | fix(customers): keep card actions inline | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `b361e5224a69` | fix(customers): align expanded card actions | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `36107192dca9` | fix(mobile): refine menu customer and map layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `2bd3f23d7cf9` | fix(ui): align pdf and signature colors | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f927cff56f1d` | fix(pdf): read legacy customer mapping keys | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `608e475787ce` | fix(ui): keep insurance contact roles on one line | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `37e33edb599c` | fix(ui): align insurance contacts with light theme | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d14eea1c95b4` | fix(pdf): preserve customer mappings during field replace saves | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `0889fd01f918` | fix(memo): improve sticky note controls | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a37a0f6b726d` | fix(memo): restore sticky note workspace | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `416bc2de9edc` | fix(memo): render routed note editor | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a4f1842ceea2` | fix(memo): show selected routed note | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `ef4f976a9f5f` | fix(memo): restore routed note canvas | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e2ec32b17ffe` | fix(pdf): restore saved customer field mappings | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `165538559d5e` | fix(customers): align unmapped map customer cards with light theme | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `81537f10db8b` | fix(customers): align map button state and workspace content | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `60c2f585c7f9` | fix(customers): restore files tab layout in workspace | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `543b6e68d4aa` | refactor(customers): compact workspace layout and file panel | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `0d7b0534c952` | refactor(customers): align customer management layout and actions | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `67d34bccecbf` | fix(user-ui): SSOT 4.3 button color hierarchy | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `4dfa298c5b42` | fix(user-ui): SSOT 4.2 align active buttons and map popup | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `bc7830de4db1` | fix(admin-ui): SSOT 4.1 admin polish | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `71cffae9e90b` | refactor(ui): SSOT 4 dark shell cleanup | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `4f7a8b0f7bb9` | fix(user-ui): SSOT danger buttons and input focus hotfix | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `376bea335888` | fix(user-ui): SSOT 3.4 modal focus relations layout | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `57abe2418c4d` | fix(user-ui): SSOT 3.3 applicant storage tabs hover | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `08d29afc857f` | fix(user-ui): SSOT 3.2 remaining dark surfaces | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `b2683c67aa3e` | fix(user-ui): SSOT 3.1 preview button gap, map tab style, app/signature light shells | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `73bb6e8340fb` | fix(user-ui): align workspace delete buttons and light panels after SSOT stage 3 | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `7252804122ff` | refactor(user-ui): normalize action buttons and modal footers | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `7769cf1b9a25` | refactor(css): align light tokens and fix customer workspace dark scope leak | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d2017cd43883` | fix(mobile): import useCallback in workspace layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `b977d529797a` | refactor(user-ui): add user workspace UI SSOT foundation | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `a7b2240b9b62` | fix(theme): apply white emerald theme and remove dark remnants | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `5f84c864bb72` | fix(memo): use sticky note canvas inside routed memo page | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `28e7d8a7ca87` | fix(memo): render selected memo content on routed page | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `ad1eb0a32def` | fix(memo): update empty state hint for routed memo page | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a61b978fc85c` | refactor(memo): move floating memo panel into main navigation | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `17a9554df8a5` | fix(desktop): load production origin for naver map authorization | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a94a1a0de179` | fix(pdf): distinguish skipped field persistence from saved mappings | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3cd86e95e4a1` | fix(desktop): inject naver map client id into electron build | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `9f0ad10ab587` | fix(customers-map-mobile): collapse controls into single toolbar row | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `694e4d1d5d7b` | fix(customers-map-mobile): prioritize map canvas behind collapsed filters | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `62ab4eb54f3d` | test(customers-map): MAP_RENDER_MODE 환경 오염으로 깨지던 지도 limit 테스트 격리 | B | QA·테스트·캡처 전용. |
| `88ba73fdcae6` | feat(customers): 신규·수정 고객 저장 시 자동 geocode 연결 | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `0519b62b4001` | chore(ops): improve production geocode backfill batching and stats | B | 문서·CI·운영 가드. 제품 런타임 변경이 아니다. |
| `996cbb1f2c42` | fix(customers-map): expand list card when entering from map detail | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `7b3419f60acb` | feat(customers-map): release customer location map MVP | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `1da99e42a2c3` | docs(ops): plan customer map restore onto develop | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `fabce1fb37a5` | fix(customers-mobile): close expanded customer card on Android back | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f4b7c16995b8` | fix(customers): normalize customer id before list dedupe and render | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `21e2d1de5f75` | fix(customers): dedupe search and list results by customer id | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `6b997976d89d` | docs(ops): align Railway deployment baseline with develop/main branches | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `15a9e95b0593` | fix(customers): load full customer list up to API limit 2000 | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `ec00cc8e6d82` | feat(company-registry): add Chubb Life to life insurer contact directory | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `08a5206e9b7b` | chore(download): point PC installer link to 1.0.242 CDN | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `c5eba151abc0` | fix(claim-requests-mobile): repair personal message compose layout and send gate | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `facdbe360688` | fix(claim-requests-mobile): wire personal message attachments on mobile UI | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `2b8b890a01ee` | fix(company-directory): persist staff contact edits with ga scope | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `21031245b4e6` | feat(customer-news): add attachments to personal messages | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `f97ab5ffdda9` | docs(ops): document prod to dev database clone runbook | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `eac96353f94f` | chore(ops): document db environments and guard destructive operations | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `a540a1231a4c` | fix(auth): match signup username case-insensitively | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `5487ab64c5f7` | chore(db): harden destructive user reset guard | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `da2da9ec63c7` | fix(customers): allow authenticated tenant lookup for customer creation | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `9240842db892` | fix(application-mobile): unify customer search row layout across entry paths | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `c351af3f073a` | fix(application-mobile): unify applicant page horizontal gutter to 16px | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a94e37a96d18` | fix(auth-pc): align login download footer with auth column | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `9ae25ae9e0e8` | fix(downloads): hardcode CDN URLs for login and intro buttons | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `7f85a4adef53` | feat(downloads): wire login and intro app download endpoints | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `234f4b253bd2` | fix(ui): align customer workspace dark surfaces | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `72ae73c4f426` | fix(pdf): separate issuance customer attribution from data loading | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `0a55eb9f691c` | fix(pdf): save issuance attribution and clarify preview modal actions | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `4fb8deb53d92` | feat(pdf): associate generated application history with customers | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `bb840951b974` | fix(pdf): preserve field customer mappings in template editor | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a1ae13264292` | fix(pdf): guard customer mapping query for preview rendering | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d164fac7212c` | fix(application): resolve multiple legacy customer cars for PDF picker | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `2bc1ffb569c9` | fix(application): show car picker after customer load when car fields mapped | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `c1e6bb002a4e` | feat(application): support optional customer car selection for PDF forms | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `90ac61fb28cd` | fix(application): apply selected customer only after load action | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `37fd88ff850b` | fix(application): align application customer lookup with customer list | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `71eb0828299b` | feat(customers): simplify consultation filter UI and API aliases | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `b734cf26d88f` | feat(customers-pc): align memo edit delete and todo actions with mobile | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `bc7f02bf4815` | fix(billing): update referral policy copy for discount plans | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `1fed67531fdd` | feat(billing): add per-plan referral discount start threshold | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `db3410614e75` | feat(billing): add admin billing plan CRUD with supply/VAT pricing | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3e90fb79a94d` | feat(billing): add GA and user billing plan assignment with unified admin UI | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `ea61f2f49ab3` | feat(billing): add VAT-inclusive pricing SSOT for virtual payments | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `3c33d20c310c` | fix(auth): block Korean characters in signup username | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `461e6d23934d` | feat(auth): allow dev-only signup phone bypass for GENERAL testing | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `ad17d262ca05` | feat(auth): add GENERAL default GA signup flow | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `1aee9d54b364` | fix(storage): remove duplicate loss adjuster category declaration | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `5dbfa97493ae` | refactor(storage): apply insurance storage layout to upload paths | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `2d1ae22132bc` | feat(storage): define insurance R2 storage layout SSOT | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `75b44a1a82b6` | fix(storage): legacy file open/download object key fallback | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `4bfaeb4a874e` | fix(customers): align storage delete modal footer with rename shell | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `87977ff81324` | fix(customers): inline workspace footer for storage delete modals | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `3e8ca376f8df` | fix(customers): unify files form modal footer shell with consultation | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `143b636228a9` | fix(customers): align delete modal footer and signature mobile controls | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `b8f2bdcf32bf` | fix(customers): portal delete footer and mobile signatures modal | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `add9b4e7b2e1` | fix(customers): strengthen workspace modal footer button visuals | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `fd9293fdcb97` | fix(customers): reuse workspace form footer in rename dialog | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `362b72900a3a` | fix(customers): align rename dialog footer with workspace action buttons | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `24d4657224eb` | fix(customers): merge workspace action className and confirm dialog footer | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `14075e38bbe9` | fix(customers): restore workspace button classes on mobile customer files | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `c7508e589dd3` | fix(customers): align mobile customer files toolbar and signature entry | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `922e3fd75ed3` | fix(customers): preserve consultation date when editing | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f0c44d94e76e` | style(customers): fix mobile workspace modal input and footer styles | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `5a7365b05a7b` | style(customers): unify mobile workspace form modal controls | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a4429bf07952` | feat(customers): add memo editing and align mobile memo layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `36c562a17dfa` | fix(customers): preserve consultation date when editing | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `0dc882d224ee` | fix(customers): exempt workspace buttons from customers-page mobile reset | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `0a6c29b646ff` | refactor(customers): drop dead storage-file-list readability override in workspace scope | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `efcfd8661f96` | refactor(customers): unify GA modal mobile save button to workspace SSOT | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `6a11e034cef0` | refactor(customers): unify file modal mobile buttons to workspace SSOT | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `35ccc449b875` | refactor(customers): rewrite workspace mobile action button CSS to single scope | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `c9b6c73afd50` | feat(web-update): detect new build and prompt reload | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `61fb9a1dd1f5` | refactor(customers): align file and ga mobile workspace shells | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `03d483898c7c` | fix(customers): apply workspace button styles to consultations | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `ebd75837d310` | fix(customers): align workspace action button mobile breakpoint | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `dff3e98a8ed3` | style(customers): enforce workspace action button sizing | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `a2e643cc1874` | style(customers): normalize workspace action buttons | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `8d1ab86a664b` | style(customers): match mobile consultation actions to memo buttons | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `552148aef365` | style(customers): fix mobile consultation button sizing | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `22c6ed7d547d` | style(customers): unify mobile consultation action buttons | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `811bf0b802c6` | feat(customers): use modals for mobile consultation add and edit | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d6dda04029e1` | fix(customers): simplify consultation edit and follow-up fields | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `65ef7b08f53b` | feat(customers): add consultation follow-up scheduling | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `dad40fc130fa` | style(customers): apply workspace close button to outlet pages | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f79cc42e6230` | fix(customers): keep customer cards unchanged after consultation filters | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `4cef0cb49a63` | feat(customers): add consultation follow-up filters and inflow source | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `d23c46840bb8` | style(customers): unify mobile workspace close buttons | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `2233ee4e9e7c` | style(mobile): align insurance crm page spacing | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `cf1ba5b10a46` | Revert "style(mobile): unify full-width page layout spacing" | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `a33cd6069fb6` | style(mobile): unify full-width page layout spacing | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `5b8c6c7a4692` | fix(newsletters): delete insurer attachments from db and r2 together | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `f1a6645efb08` | fix(newsletters): build cdn image urls from stored object keys | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `468a3a0111a1` | fix(newsletters): restore legacy cdn image rendering | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `e8e720eb5c36` | fix(newsletters): serve insurer news images through accessible urls | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `5447383bdd7d` | fix(newsletters): restore mobile text fallback for image-missing cards | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `0ecebf431236` | fix(newsletters): remove body text preview from mobile list cards | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `39fe3ec44e4b` | fix(newsletters): restore mobile insurer newsletter images | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d4ffc9e82bd4` | feat(customers): add consultation date filters and editing | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `0ab61b19f3cd` | fix(claims): reduce mobile claim inbox bottom whitespace | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d1164d089601` | fix(claims): repair claim inbox mobile list background | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `7c9b918320f2` | fix(claims): prevent mobile claim list panel clipping | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `d5f75260f36c` | fix(claims): stabilize mobile claim file downloads and layout | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `83e11e7d3f60` | fix(customer-app): use native links for mobile claim downloads | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `cffe9b82edbd` | fix(customer-app): support mobile claim attachment downloads | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `dd1a4062c0fe` | fix(billing): default admin payment mode to virtual | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `fc89ea76fe10` | feat(billing): add virtual subscription payment foundation | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `00fc04cf915c` | feat(referrals): add referral code and referred user status | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `bcbb76840b4a` | style(contracts): clean up signature screens for production | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `f45f69af4e6c` | fix(customer-app): show image-only customer messages | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `6475f01266ee` | fix(customer-app): allow inline message images with access token | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `6257deee16e4` | fix(customer-app): resolve message attachment image download route | A | develop에만 있는 제품 변경. main 재적용은 최신 main 동작과 충돌할 수 있어 이번 릴리스 브랜치에는 세 기능만 올렸다. |
| `c56088f7a9fb` | feat(customers): add customer scoped signature workspace | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `d5f730f4db28` | fix(government): validate application case scope on pdf and edoc | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `3d718123d5ce` | test(government): verify government support crm flow | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `9eca945cf73e` | feat(government): connect documents files and schedules | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `2ee18100b997` | feat(government): prepare pdf coordinate mapping | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `70db5f7765ed` | feat(government): connect electronic document entry points | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `821742eb724c` | feat(government): add application case workflow | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `34b9c7d0a40c` | feat(government): add funding loan delegation forms | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `47be06494548` | feat(government): add reception customer business forms | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `ea15f0c26eb9` | feat(government): add government workspace layout | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `c037d82cfdb2` | feat(government): add agency code onboarding | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `b4d4a7890a47` | feat(government): add government auth routes | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `251a52d13915` | ﻿feat(government): add role model for government support | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
| `feb223ed4e3e` | ﻿chore(government): analyze existing crm structure | D | patch-id가 origin/main의 커밋과 동등. 다시 넣으면 중복이다. |
