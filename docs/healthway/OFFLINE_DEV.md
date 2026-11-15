# Healthway OFFLINE DEV

상태: **오프라인 개발 구현 / 실제 연계 UNVERIFIED**. `feat/healthway-offline-t746` 전용. main/develop push, Railway 변경, 실제 건강정보 조회, 실제 SMS, 공식 마스터 적재는 수행하지 않았다. 네이티브 앱은 후속 범위다.

## 구조와 경계

```text
React 고객 상세 건강정보 / 공개 health-connect 화면
  → ONE FC Express /healthway (기존 /backend 및 /api mount)
    → 내부 Java Healthway Adapter (HMAC-SHA256)
      → 공식 platform-sdk 0.2.8-SNAPSHOT (offline)
        → 운영자가 제공하는 공식 SampleTestResponseData
```

- Java 17, JDK HttpServer, SDK fat JAR의 HAPI FHIR R4 5.6.5 및 Jackson. 루트 NIXPACKS/Node 빌드 설정은 변경하지 않는다. 컨테이너 빌드는 `services/healthway-adapter/Dockerfile`만 사용한다.
- 어댑터는 SDK 호출과 FHIR 정규화만 수행한다. 고지 분석은 `server/healthway/rules.js`에서 요청 시 재계산한다. AI 호출은 없다.
- Java는 토큰을 저장하지 않는다. Node가 전용 AES-256-GCM 키와 고객 scope AAD로 이용자번호/CI/토큰 및 원본 FHIR를 암호화한다. 정규화 JSON과 원본 암호문은 별도 칼럼이다. 분석 결과는 원본 테이블에 쓰지 않는다.
- `HealthwayProvider`: Offline 활성. Testbed/Production은 설정 경계만 준비한 **호출 차단 stub**이다. properties 파일만 마운트한다고 실연계가 활성화되지 않는다. Production은 `HEALTHWAY_ALLOW_PRODUCTION=true`도 요구하지만 여전히 stub 호출을 차단한다.
- `TransmissionSignatureProvider`는 0199용 전자서명 인터페이스다. 현재 구현은 `OfflineMockSignatureProvider`뿐이며 결과마다 `mock:true`를 붙인다. 기존 이미지 서명은 사용하지 않는다.
- 소스는 `NHIS_PUBLIC`(2001/2002), `HIRA_PUBLIC`(2004), `MEDICAL_INSTITUTION`(1004/1010)으로 유지한다. 건강검진/진료/투약/진단/처치의 서로 다른 필드를 하나의 임상 DTO로 섞지 않는다.

## 공개 저장소에서 제외하는 자료

`services/healthway-adapter/.gitignore`가 `lib/`, `sample-data/`, `runtime/`, `build/`, JAR, mymd.properties를 제외한다. 공식 JSON, 문서 텍스트, 키/credential을 Git에 추가하지 않는다. ESI 이름 사전도 `stage.sh`가 외부 공식 표에서 생성하여 **ignored sample-data**에만 둔다.

Node 테스트는 테스트용임을 명시한 **우리 정규화 계약 fixture**만 사용한다. Java 테스트만 외부 공식 샘플을 읽는다. Procedure fixture는 의료 표준 문서의 구조를 따른 합성 테스트이며 공식 샘플로 취급하지 않는다. 브라우저 스크린샷은 샘플 건강정보가 포함될 수 있으므로 `/tmp` 등 저장소 밖에 보관한다. 링크 원문/credential은 실행 로그에 남기지 않는다.

## 설정

공유 비밀과 암호화 키는 각각 새로 생성하고 비밀 저장소/로컬 보호 파일로 주입한다. SMS/결제 키를 재사용하지 않는다. 아래에는 비밀값 예시가 없다.

| 위치 | 환경변수 | 의미 / 기본값 |
|---|---|---|
| 빌드/테스트 | `HEALTHWAY_SDK_DIR` | 외부 SDK 디렉터리. 로컬 기본 `/workspace/t746-work/sdk` |
| Java 빌드/실행 | `JAVA_HOME` | JDK 17. 로컬 기본 `/workspace/tools/jdk17`; Docker는 이미지 JDK/JRE |
| Java | `PORT` | 기본 8080. `::`에 bind하여 IPv6/IPv4 지원 |
| Java | `HEALTHWAY_SAMPLE_DATA_DIR` | stage된 공식 샘플 경로, 기본 `sample-data` |
| Node/Java | `HEALTHWAY_PROVIDER` | 기본 offline. 현재 Node는 offline만 허용 |
| Node/Java | `HEALTHWAY_ADAPTER_SHARED_SECRET` | HMAC 공유 비밀, 최소 32자. 필수 |
| Java | `HEALTHWAY_LOCAL_TEST_MODE` | 명시적으로 true인 offline 로컬 테스트만 비밀 없이 기동 허용. 임시 랜덤 비밀이 생성되어 외부 호출자는 접근 불가. 통합 테스트에는 사용하지 않음 |
| Java | `HEALTHWAY_ALLOW_PRODUCTION` | production provider 선택의 추가 차단 장치. 현재 online 호출은 이 값과 무관하게 stub으로 차단 |
| Java 향후 | `HEALTHWAY_MYMD_PROPERTIES` | 승인받은 properties 마운트 경로. 현재 stub의 설정 경계 |
| Node | `HEALTHWAY_MODULE_ENABLED` | 기본 false. false면 모듈 API 404, 스키마 생성 생략, 건강정보 진입 메뉴 숨김 |
| Node | `HEALTHWAY_ADAPTER_URL` | Java 내부 서비스 URL. localhost 또는 private network 사용. URL 내 credential 금지 |
| Node | `HEALTHWAY_TOKEN_SECRET_KEY` | 새 전용 32바이트 키, base64 또는 64자리 hex. AES-256-GCM |
| Node | `HEALTHWAY_OFFLINE_AS_OF_DATE` | 필수 YYYY-MM-DD. 화면/API에 **오프라인 샘플 기준일** 표시 |
| Node | `NODE_ENV`, `APP_ENV`, `RAILWAY_ENVIRONMENT_NAME`, `RAILWAY_ENVIRONMENT` | production/prod 런타임에서 offline 공개 MOCK 경로 차단. 이 모듈은 production 런타임에서 사용 불가 |
| Node 테스트 | `HEALTHWAY_TEST_DATABASE_URL` | 별도 로컬 테스트 DB. 매 실행 격리 schema 생성/삭제. 없으면 PostgreSQL suite만 skip |
| 마스터 import | `HEALTHWAY_IMPORT_DATABASE_URL` | 명시적 import 대상 DB. 기본 DB로 자동 fallback하지 않음 |
| E2E | `HEALTHWAY_E2E_BASE_URL` | 실행할 로컬/DEV 웹 URL. production URL 사용 금지 |
| E2E | `HEALTHWAY_E2E_USERNAME`, `HEALTHWAY_E2E_PASSWORD` | 테스트 FC 로그인. 로그/소스에 넣지 않음 |
| E2E | `HEALTHWAY_E2E_CUSTOMER_ID` | 선택사항. 없으면 테스트 FC 첫 고객 |
| E2E | `HEALTHWAY_E2E_API_PREFIX` | fetch E2E API prefix, 기본 /backend |
| 브라우저 E2E | `HEALTHWAY_PLAYWRIGHT_MODULE` | 선택사항. 외부 설치된 Playwright 모듈의 절대 경로, 기본 playwright |
| 브라우저 E2E | `HEALTHWAY_CHROME_PATH` | 선택사항. 설치된 Chrome 경로 |
| 브라우저 E2E | `HEALTHWAY_E2E_ARTIFACTS` | 스크린샷 경로. 기본 /tmp/healthway-e2e-artifacts |

오프라인은 `runtime/mymd.properties`에 `mymd.mode=offline`과 절대 `mymd.datapath` **두 설정만** 생성한다. runtime 디렉터리는 manifest classpath에 포함한다. SDK 설정 파일/키를 Node 앱 루트에 두지 않는다.

표본 기간이 섞여 있으므로 로컬 검증에는 `HEALTHWAY_OFFLINE_AS_OF_DATE=2024-08-07`을 사용했다. 이 날짜에서 E2E는 2001/2002/2004/1004를 함께 표시한다. 의료 Condition의 recordedDate가 기준일 이후인 샘플도 있어, 해당 진단은 원본대로 표시하되 그 날짜를 포함하지 않는 분석 창에서는 제외된다. 0206은 원본 4건 중 조회 창 밖 1건을 제외하여 3건을 저장한다. 이 값은 실제 현재 시점 조회 보장이 아니다.

## 어댑터 실행

```bash
export HEALTHWAY_SDK_DIR=/workspace/t746-work/sdk
export JAVA_HOME=/workspace/tools/jdk17
services/healthway-adapter/stage.sh
services/healthway-adapter/build.sh
# 보호된 환경에 HEALTHWAY_ADAPTER_SHARED_SECRET을 주입한 뒤:
HEALTHWAY_PROVIDER=offline PORT=8080 services/healthway-adapter/run.sh
```

`build.sh`는 lib가 없으면 stage.sh를 호출한다. SDK 디렉터리는 `lib/*.jar`, `SampleTestResponseData/*.JSON`, `docs-txt/checkup-demand-data-ESI.txt` 구조를 기대한다. Maven/루트 Dockerfile이 필요하지 않다.

```bash
# stage 후, 이 서비스 디렉터리만 Docker context로 사용:
docker build -t healthway-adapter services/healthway-adapter
# private network에서만 실행. 공유 비밀은 secret/env 주입. public 도메인 연결 금지.
```

`GET /healthz`만 인증 없이 허용하며 `ok/mode/provider/sdkVersion` 네 필드만 응답한다. 준비되지 않은 provider는 503/ok=false다. 그 외 모든 엔드포인트에 HMAC이 필요하다. SDK 자체 stdout/stderr는 HTTP 서비스에서 차단한다.

### 내부 계약 (우리 API이며 upstream HTTP API를 가정한 것이 아님)

- `POST /sdk/{PG-SDK ID}`: `{ args: [...공식 메서드 인수], token?: ... }`. DTO는 JAR 타입으로 엄격 변환한다. 입력으로 임의 메서드명을 지정할 수 없다.
- `POST /sdk/0221`: 공식 샘플이 없어 local mockAuthPath와 demandDealingsNo를 받는 명시적 MOCK 분기. 0200을 대신 호출하지 않는다.
- `POST /signature`: offline 전자서명 MOCK. `mock`, `label`은 우리 envelope이며 upstream 필드가 아니다.
- 응답: `mock:true`, provider, sdkId, `data` 또는 `records`. 정규화 레코드는 contractVersion=1, id, source, datasetCode, kind, date 및 출처별 필드와 rawResource/rawContext를 가진다. Node는 raw를 암호화하고 웹 응답에서는 제외한다.
- HMAC canonical: `POST\nPATH\nUNIX_SECONDS\nNONCE\nSHA256(BODY)`의 UTF-8 HMAC-SHA256 lowercase hex. 헤더는 X-Healthway-Timestamp / Nonce / Signature. 5분 skew, nonce replay cache, 1MiB Java 본문 제한, Node 30초 timeout, 리다이렉트 금지.

### SDK ID 허용 목록

Support: 0003, 0005, 0187, 0220, 0221, 0201, 0051, 0002, 0034, 0096, 0008.
Agreement: 0010, 0011, 0012, 0013, 0014.
Transmission: 0199, 0203, 0190, 0215, 0204, 0206, 0207, 0219, 0205.

메서드 이름과 인수 타입의 기준은 제공된 `javap/*.txt` 및 JAR다. 0221은 `findUnitySubscription4Certification`, 0219는 `findDemandTokenMedicationDispenseSensitiveInformationByUserNo`, 0205는 `findDemandTokenMedicalDataByProvideInstitution`이다. 삭제/구형 0200·0209는 허용하지 않는다. 초기 동기화는 0002 이용자 토큰, 0012 항목동의, 기관별 0199 후 해당 토큰을 각 조회에 전달한다. 갱신·상태·동의 변경 메서드는 어댑터 경계까지 제공하며 주기 동기화/배치는 이번 offline UX에 포함하지 않는다.

## Node API와 요청 수명

아래 경로 앞에 `/backend/healthway` 또는 `/api/healthway`를 붙인다.

| 경로 | 동작 |
|---|---|
| GET /availability | 인증된 세션의 활성 여부 |
| POST /customers/:customerId/requests | NHIS/HIRA 또는 양쪽, medical 옵션 요청 생성 |
| GET /customers/:customerId/requests[/:id] | 목록/상태·timeline |
| POST /customers/:customerId/requests/:id/cancel | 완료 전 요청 취소 |
| POST /customers/:customerId/requests/:id/sms-preview | CRM 문자 포맷/바이트 정책 재사용, 실제 sender 호출 없이 dry-run |
| POST /customers/:customerId/revoke | 연결 해제, 0203 및 0008 offline 호출, 민감 레코드/토큰 삭제, 미완료 링크도 폐기 |
| GET /customers/:customerId/records?source=... | 정규화 자료 + 출처별 coverage |
| GET /customers/:customerId/analysis | 현재 규칙 버전으로 재계산 + evidence |
| GET /customers/:customerId/kcd-search?q=... | 적재된 공식 마스터 코드/이름 검색 |
| GET /public/:token | 마스킹 이름, 약관/통합가입 안내, 상태 |
| POST /public/:token/start | 기관별 동의 확인, MOCK 0221 시작, nonce 생성 |
| POST /public/:token/mock-auth | DEV MOCK callback 처리·단일 완료·SDK 조회 |

FC API는 기존 requireAuth, resolveSmsAuthContext, assertCustomerOwnedByScope를 재사용한다. customerId/owner_user_id/ga_id 세 조건으로 고객 자료를 한정하며 GA는 사용자 DB에서 다시 확인한다. 공개 링크만 해시로 요청을 찾은 뒤 그 요청의 세 조건으로 후속 쿼리를 수행한다. 질병/약품 마스터와 규칙은 전역 기준 데이터다.

요청은 32 random bytes base64url, SHA-256만 DB에 저장, 24시간 만료다. raw 링크는 생성 응답에서 한 번 반환하므로 새로고침 후 복원이 불가하다. 새 링크가 필요하면 새 요청을 생성한다. 기본 상태 전이는 created → opened → consented → auth_pending → processing → authenticated → dataset_consented → signed_mock → completed다. callback은 DB 잠금 아래 nonce 해시와 demandDealingsNo를 검증하고 **network 호출 전에 사용 처리**한다. 완료·실패·취소·철회·만료된 요청의 인증 재사용은 막는다. 조회 GET은 완료 안내만 허용한다.

callback 처리 실패는 failed로 남고 새 요청이 필요하다. 취소/철회와 완료가 경합하면 완료 트랜잭션이 활성 상태를 재검사한다. 고객별 connection 교체는 advisory transaction lock으로 직렬화한다. 여러 요청으로 동기화해도 최신 스냅샷만 유지한다. IP별 프로세스 rate limit(90/min), DB 시작 시도 상한(3), nonce replay 방어를 둔다. 다중 Node 인스턴스 전체 IP 제한은 추후 공통 limiter로 옮길 수 있다.

0199/0201 공식 샘플은 고정 기관·tx·요청번호와 과거 토큰 만료일을 반환한다. **이를 실제 요청의 인증 결과나 실시간 토큰으로 위장하지 않는다.** 공식 sampleDemandDealingsNo는 암호화된 MOCK credential 안에 보존하며, 개발 콜백 바인딩은 별도로 생성한 nonce+demandDealingsNo로 검증한다. 실제 0201은 복호화 결과 demandDealingsNo 일치 검증까지 추가해야 한다. CASE1/CASE3만 성공 흐름으로 진행하고 CASE2/CASE4는 실패한다. CASE1 저장 실패의 0051 보상 호출도 준비했다.

## 데이터 범위·정규화와 공식 근거

근거는 외부 제공 자료의 텍스트 버전 기준이며 문서 자체를 저장소에 복제하지 않았다.

| 데이터셋 | 범위 | 근거 |
|---|---|---|
| 2001 | 기준일 이전 10년 | sdk-technical-guide v2.0 PG-SDK-0206 p133, txt 6478–6482행 |
| 2002 | 기준일 -14개월 ~ -2개월, 1회 최대 1년 | PG-SDK-0207 pp134–135, txt 6539–6543 및 6567–6575행 |
| 2004 | 보장 기간 명시 없음. 수신 데이터 날짜 범위만 | PG-SDK-0219 pp137–138, txt 6673–6760행. 해당 절에 기간 보장 없음 |
| 1004/1010 | 수신 데이터 날짜 범위만 | PG-SDK-0205 pp131–132, txt 6374–6460행. 승인된 기관/데이터셋만 조회 |

`healthway_source_coverage`는 dataset별 availableFrom/availableTo/retrievalRange/basis를 보관한다. 공식 규칙과 received-data를 구분하고 후자는 연속 기간 완전성 미확인으로 표시한다. received-only의 양끝 날짜만으로 전체 음성 판정을 내리지 않는다. 공식 SDK offline은 요청 날짜를 무시하고 static sample을 반환하므로 2001/2002는 Node에서 공식 창으로 필터링한다. 메타데이터에 5년 범위를 꾸며 넣지 않는다.

- **2001**: 공공 표준 §4.1.2/4.1.3의 DiagnosticReport 및 contained Observation/QuestionnaireResponse. ESI 이름은 `checkup-demand-data-ESI.txt`를 stage 시 읽어 원본 값·단위를 표시한다. 종합소견은 conclusion을 원문으로 보존한다. 영유아 샘플 수치를 성인 BMI/혈압 값으로 바꾸거나 단위를 추측하지 않는다.
- **2002**: 공공 표준 §4.1.4 pp23–27, txt 2081–2462행. billablePeriod.start, provider Organization 이름/주소/identifier, type institutional/pharmacy, supportingInfo의 hospitalized/related/other → 방문입원일수/처방횟수/요양투약일수, total copay/benefit만 정규화한다. **진단·질병명·진료과 필드는 없다.** category명 hospitalized라도 외래 방문이 포함되므로 입원 확정으로 바꾸지 않는다.
- **2004**: 공공 표준 §4.1.5/4.1.6/4.1.7, txt 2463행 이후. MedicationDispense의 whenPrepared/daysSupply/dosageInstruction, Medication의 KD 원본 코드·system·display, Substance의 주성분 코드/명, performer 약국. 약효분류/질환명은 만들지 않는다.
- **1004**: 의료 표준 §3.5 Condition, txt 1553–1730행. KCD-8 system `http://www.hl7korea.or.kr/CodeSystem/kostat-kcd-8`인 실제 coding만 질병코드로 취급한다. 원본 code/display와 recordedDate, encounter reference → Encounter period/class/serviceProvider를 유지한다. 내원 표준 §3.4 pp13–14, txt 1439–1550행의 AMB/EMER/IMP를 사용한다.
- **1010**: 의료 표준 §3.14 Procedure, pp42–43, txt 3160–3280행. status, code(coding: EDI/ICD-9-CM), performedDateTime, encounter를 파싱한다. **수술 및 처치**이므로 수신 자체를 보험 약관상 수술로 확정하지 않는다. 현재 공식 샘플 없음. doc-shaped fixture 검증만 완료했다.

### 2002 ↔ 1004 연결 조사

공단 EOB의 provider는 contained Organization을 참조한다. 공식 샘플에는 기관 identifier.value가 있지만 system이 없다. 의료 Condition은 `Encounter/427`을 참조하고 Encounter.identifier는 기관 OID + 내원 접수번호다. serviceProvider는 `Organization/390`을 참조하지만 해당 Organization 리소스는 0205 샘플에 없다. 공공 EOB에 같은 Encounter/접수번호는 없고, 로컬 리소스 id를 출처 간 같은 ID로 해석할 근거도 없다.

따라서 현재 공식 자료에서 확정 연결 가능한 공유 키는 **확인되지 않았다**. 동일 날짜 또는 기관명은 UI의 **관련 진단 후보**로만 제공한다. system 없는 기관번호를 의료기관 OID와 임의 변환하지 않는다. 같은 기관/날짜라도 하나의 진료·진단으로 합산하지 않는다. 실제로 강한 공통 식별체계+값이 제공되는지는 testbed에서 추가 검증해야 한다.

## KCD·약품 마스터와 규칙

- 마스터 데이터는 **0건 적재**했다. KCD는 case/space/dot tolerant하게 `I109` → `I10.9`로 정규화하되 원본을 유지한다. 표시 우선순위: 공식 disease_code_master.korean_name → 1004 coding.display(원본 표시명 배지) → 코드 확인 필요. EOB에는 KCD를 붙이지 않는다.
- `disease_code_master`, `healthway_disease_groups`, `medication_master` 스키마를 준비했다. 이름/그룹/약효는 AI로 생성하지 않는다. exact KCD → 공식 parent KCD → 명시적 admin disease group 순서로 반복 후보를 평가한다. 코드 없는 공공 진료의 반복은 동일 기관·진료형태 반복으로만 표시한다.
- `scripts/healthway/import-master.mjs`는 별도로 확보한 공식 CSV/XLSX와 source/version/columns mapping JSON을 입력받는다. 파일의 실제 헤더를 mapping에 명시한다. kcd: code_raw/korean_name 및 선택 parent_code/disease_group. medication: code_raw/code_system/name 및 선택 ingredient_code/ingredient_name/class_code/class_name. codeSystem은 공식 체계를 설정으로 제공할 수 있다. 앞자리 0 보존을 위해 공식 코드는 text 열이어야 한다.

```bash
# 먼저 validate만 수행. 실제 공식 파일은 이 저장소 밖에 둔다.
node scripts/healthway/import-master.mjs kcd /secure/official.xlsx /secure/kcd-columns.json
# 승인된 대상 DB를 명시했을 때만 --apply. 이번 작업에서는 실행하지 않음.
```

`disclosure_rules`는 rule_type, required_sources, lookback_days, min_visit_days, min_medication_days, disease_group, enabled, version으로 설정한다. seed는 개발 테스트용 3개월 진료(90일), 1년 반복(365일/3일), 치료 7일, 투약 30일, 입원, 수술, 5년 반복(1825일)이며 보험사/상품의 법적 기준으로 간주하지 않는다. 변경 시 version을 갱신한다.

- DETECTED = 확인 필요, NOT_DETECTED = 특이사항 없음, INSUFFICIENT_DATA = 데이터 부족, UNSUPPORTED = 현재 조회 불가.
- 요구 창이 required_sources의 확보 범위를 초과하면 양성 근거가 일부 있어도 INSUFFICIENT_DATA다. 근거 ID는 남겨 확인할 수 있다. 공단의 최근 2개월 공백 때문에 오늘 기준 3개월/1년을 모두 확보했다고 주장하지 않는다.
- 투약은 원본 drug system+code별 `[조제일, 조제일 + daysSupply - 1]` 구간 합집합, 분석 창으로 clip한다. 중복/인접 기간을 제거한다. 조제일이 없으면 estimated:true / 추정으로 별도 표시하며 확정 기간으로 보이지 않게 한다.
- 치료는 방문입원일수·요양투약일수·실제 Encounter 기간에 근거한 가능성이다. 입원은 IMP 또는 EOB 방문입원일수 후보이며 후자는 추정/입원 확정 불가 문구를 붙인다.
- 수술은 1010 자료/coverage가 없으면 UNSUPPORTED / 공공데이터만으로는 확인 불가. 1010이 생기면 자동 평가하되 요구 범위가 부족하면 INSUFFICIENT_DATA다.

## 테스트와 재현

```bash
services/healthway-adapter/test.sh
# 공식 SDK/샘플이 없으면 Java 테스트는 SKIP 후 성공 종료한다.

node --test server/healthway/rules.test.js server/healthway/security.test.js
# 별도 비운영 테스트 DB를 미리 생성한 뒤:
HEALTHWAY_TEST_DATABASE_URL="$LOCAL_TEST_DB_URL" node --test server/healthway/*.test.js

npx vitest run src/features/healthway/components/healthway.test.tsx
npx eslint src/features/healthway --ext .js,.jsx,.ts,.tsx
npm run build
npm test
npm run test:web
npm run lint
```

서버 전체 테스트 중 일부 기존 모듈은 DATABASE_URL을 요구한다. 전체 검증에는 별도로 만든 로컬 DB만 사용하고 `server/.env` 운영 proxy를 사용하지 않는다. Healthway 통합 테스트 자체는 HEALTHWAY_TEST_DATABASE_URL만 읽어 격리된 임시 schema를 생성/삭제한다.

로컬 앱의 정상 로그인 가능한 테스트 FC와 그 FC 소유 고객을 준비한다. Node 설정을 주입하고 기존 `node server/index.js` 또는 `npm run dev`로 기동한다. Java 어댑터도 같은 공유 비밀로 별도 실행한다. fetch E2E는 built SPA deep URL도 확인하므로 `npm run build` 후 Express가 dist를 서비스하거나 Vite에 연결된 URL을 사용한다.

```bash
# E2E 환경에 BASE_URL / USERNAME / PASSWORD를 안전하게 주입한 뒤:
node scripts/healthway/e2e.mjs
# 선택: 외부 설치한 Playwright와 로컬 Chrome 경로를 주입:
node scripts/healthway/browser-e2e.mjs
```

fetch E2E: 실제 앱 로그인 → 고객 → 요청 → 공개 SPA → 약관 → 기관 동의 → MOCK 0221 → callback/0201/0012 → 기관별 0199 → 0206/0207/0219/0205 → records → analysis/evidence → callback replay 거절. 브라우저 E2E는 별도 고객 브라우저 context로 실제 UI 동의, PC 1920/1280/1024, touch mobile 390, 출처 탭/근거 모달을 검사한다. 실제 SMS sender를 import/호출하지 않는다.

### 이 작업의 검증 결과

- Java: 공식 0005/0201/0199/0206/0207/0219/0205 실행, parser 2001/2002/2004/1004 및 1010 문서 fixture, HMAC HTTP 인증·skew·replay, provider fail-closed: **43 assertions PASS**.
- Healthway Node: 규칙/보안/실제 PostgreSQL HTTP 통합 suite **43 tests PASS**.
- 신규 웹 **7 tests PASS**, 신규 모듈 ESLint **0 errors**, Vite build PASS.
- fetch E2E **12 stages PASS**: 29 레코드, 7 규칙. 브라우저 **13 checks PASS**: PC 1920/1280/1024 + mobile 390, source 탭/근거/고객 MOCK 흐름과 모바일 미저장 닫기 방어. 실제 앱 로그에서 공식 샘플 identity/token 5종 미출력 확인.
- 기준 커밋 `3645f9ba`를 별도 임시 archive에서 같은 환경으로 실행하여 기존 실패를 비교했다. 서버 전체의 기존 실패 27개, 웹 기존 실패 28개 및 suite 오류, 전체 lint 721 errors/42 warnings가 기준에서도 재현되며 새 Healthway 실패는 없다. 기존 모듈 수정 금지 범위이므로 이 실패들을 수정하지 않았다. 전체 체크가 green이라고 보고하지 않는다.

## 발견한 불일치 및 UNVERIFIED

1. 가이드 SDK 버전 0.2.7 예시와 제공 JAR 0.2.8-SNAPSHOT 차이. 실측 JAR 시그니처를 따른다.
2. 0221 공식 offline 파일 없음. 테스트 전문에는 구 FIND_SUBSCRIPTION_4_CERTIFICATION 파일을 0221로 설명하나 JAR의 새 메서드 sample이 아니다. 구 0200 호출로 우회하지 않았다.
3. 구 MEDICATION_DISPENSE_BY_USER_NO 파일은 Immunization이다. 2004에는 최신 SensitiveInformation 0219 파일만 사용한다.
4. 0205에 Condition 1건/Encounter는 있으나 참조 Organization이 없다. 제공기관의 강한 공유 키 검증은 UNVERIFIED.
5. 1010 샘플 없음. 구조와 자동 활성화 테스트만 완료했으며 실제 Procedure 응답 검증은 UNVERIFIED.
6. 2001 샘플은 영유아만 있다. 성인 혈압/혈당/BMI는 표준 ESI 구조를 지원하지만 실제 성인 응답 검증은 UNVERIFIED.
7. offline SDK는 날짜 필터·인증 바인딩·기관별 tx/토큰을 현실적으로 시뮬레이션하지 않는다. Node 날짜 필터와 별도 DEV nonce로 보완하며 모두 MOCK이라고 명시한다. 샘플 토큰의 과거 만료값을 실제 유효기간으로 위장하지 않는다.
8. 0002 AccessTokenDTO는 access_token/validity_date_time(snake case)이다. 가정한 token 필드를 사용하지 않는다. 0199는 accessToken/camelCase다.
9. 0221 DTO setter는 setJoinPhr/setJoinPortal이고 가이드는 isJoinPhr/isJoinPortal로 설명한다. Java real path 구현 시 JAR의 DTO를 기준으로 전달해야 한다.
10. 실제 testbed 인증/암복호화/서명/외부 철회(A1PC400/401)/갱신/등록 callback, 승인된 기관·데이터셋 및 실서비스 네트워크 조건은 UNVERIFIED. Java의 관련 SDK 인터페이스 경계는 준비했으나 온라인 운영 동작을 주장하지 않는다.
11. native iOS/Android/Electron 전용 UX 검증, Railway private IPv6 실제 서비스간 연결, 온라인 다중 인스턴스 통합 limiter는 후속이다. 이번 로컬 JVM IPv6 wildcard bind의 IPv4 접근과 HMAC은 검증했다.

## Provider 교체 체크리스트 (이번 작업에서는 수행하지 않음)

- 누리집 활용기관/활용서비스 및 testbed 이용 승인, 목적/제3자 제공 동의 범위 확인.
- 활용서비스별 정식 mymd.properties를 Java 쪽에 마운트. 승인 properties의 임의 API endpoint/credential 생성 금지.
- 발급받은 tester ID, 승인된 데이터셋 목록, 실제 의료기관 provideInstitutionNo/careInstitutionSign, 등록된 callback URL을 설정/마운트 파일로 제공.
- 정식 encryption/decryption key pair를 Java 전용 비밀 파일로 마운트하고 SDK 공통 DTO에 연결. Node 전용 AES 키와 구분.
- 실제 전자서명 인증사업자 계약/공식 API 문서 확보. caCode/signClientId/contentId/signedContent/txId/siteTxId mapping을 공식 가이드와 대조하여 새 TransmissionSignatureProvider 구현.
- ConfiguredHealthwayProvider stub에 승인된 SDK 설정 경로·인증키 로딩을 구현하고 testbed부터 검증. credential 파일 존재만으로 real call을 켜지 말 것. 현재 live stub 차단을 해제하려면 별도 구현/검증이 필요하다.
- 실제 0221 화면 POST, 정식 callback/cert route, 0201 복호화 결과 요청 바인딩/CASE1~4 및 0051 보상 처리를 검증.
- 0010~0014 동의 동기화, 0204 갱신, 0096/0215 외부 철회 감지, 0190 정리, 기관별 0203/전체 0008을 testbed에서 검증. offline 과거 토큰 대신 실제 만료 처리 연결.
- 공식 KCD/약품 마스터 확보 후 version/source와 실제 열 mapping으로 import. 공식 한글명/분류 외 생성 데이터 적재 금지.
- 성인 2001 및 실제 1004 Organization/1010 응답으로 파서/coverage 재검증. 강한 연결 키가 입증되기 전에는 후보 표시 유지.
- 내부 서비스 HMAC/secret rotation/로그 redaction/데이터 보존·파기를 검토. 웹 public exposure 없이 내부 네트워크로만 연결.
- production 반영은 별도 명시 승인 + develop 검증 후 검증 커밋 cherry-pick만 허용. 이 문서는 배포 승인이나 실조회 승인이 아니다.

### 최종 회귀 비교 (2026-11-15, 격리 로컬 DB)

| 검증 | 3645f9ba 기준 | Healthway 적용 후 |
|---|---|---|
| npm test | 2,186 PASS / 27 FAIL (2,213) | 2,229 PASS / 27 FAIL (2,256) |
| npm run test:web (Vitest 단계) | 1,227 PASS / 28 FAIL / 1 SKIP | 1,234 PASS / 28 FAIL / 1 SKIP |
| npm run lint | 721 errors / 42 warnings | 721 errors / 42 warnings |
| 신규 모듈 lint | 해당 없음 | 0 errors |
| npm run build | — | PASS |

서버 실패 제목의 multiset 비교 결과 신규 실패 0개였다. 웹은 기존 15개 파일 실패(일부 suite 오류 포함)가 두 버전에서 동일하게 재현되어 runner의 후속 node:test 단계는 실행되지 않았다. 신규 웹 7개는 별도로도 모두 통과했다. TypeScript 전체 검사도 기존 오류로 실패하며 신규 Healthway 경로의 진단은 0건이었다. 이 결과는 전체 저장소 테스트가 green이라는 뜻이 아니다.

최종 보강에는 같은 요청에 대한 동시 callback 단일 완료, SDK 조회 도중 취소한 요청의 snapshot 복원 금지, nonce 교체 및 DB 시도 횟수 상한, FC 계정 전환 시 화면 state 분리, 모바일 미저장 요청 설정 취소 확인이 포함된다. SDK JAR·공식 샘플·가이드·키 material이 tracked 파일에 포함되지 않았는지도 확인했다.
