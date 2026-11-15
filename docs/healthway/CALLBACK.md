# 인증결과전송 callback (DEV)

## 공식 근거와 등록 URL

SDK 기술가이드 p.39–40의 활용서비스 등록 `callback url`(신청서의 **인증결과전송 URL**)을 기준으로 한다. 정보주체가 본인인증·이용가입을 마치면 중계시스템은 **정보주체의 브라우저**를 `<callback url>/cert?resultData=<암호화된 데이터>`로 리디렉션한다. 가이드 예제는 `GET /rslt/cert` 컨트롤러다.

등록할 값:

```text
https://<host>/api/healthway/callback
```

실제 수신 경로는 `GET /api/healthway/callback/cert`다. 로그인 세션을 요구하지 않는다. HEAD·POST·OPTIONS 등 GET 외 메서드는 `405`와 `Allow: GET`을 반환한다. 별도 읽기 API는 제공하지 않는다.

PG-SDK-0201(p.59–60)의 공식 메서드는 `findDecryptDataBySubscriptionCertification(resultData, decryptionKey)`다. 가이드에는 콜백 서명 헤더가 없다. **SDK 복호화가 검증 경계**이며, 임의의 HTTP 서명 헤더·파라미터를 요구하지 않는다. 키는 PG-SDK-0029(활용기관 암호화 KEY 요청)에서 받은 decryptionKey를 별도로 안전하게 설정한다. 제공된 `javap`에서도 인수 두 개가 모두 String임을 확인했다. 공식 문서·JAR·샘플·키는 공개 저장소에 포함하지 않는다.

## 검증과 요청 처리

- `resultData` 한 개가 필요하다. 빈 값, 16,384자 초과, 제어문자(U+0000–001F, U+007F–009F), 중복 `resultData`는 `400 invalid_input`. 다른 쿼리 파라미터는 무시한다. 실제 암호문 형식은 추측하지 않는다.
- 현재 라우터의 `assertConfigured()`는 **비운영 offline만 허용**한다. testbed/production은 키가 있어도 `503 provider_not_configured`이며 어댑터를 호출하지 않는다. Production 차단은 변경하지 않았다.
- 향후 실제 provider 검증 경계는 `verifyCallbackResult()`에 분리되어 있다. provider가 testbed/production이고 환경변수 `HEALTHWAY_DECRYPTION_KEY`가 설정된 경우에만 어댑터 `/sdk/0201`에 `[resultData, decryptionKey]`를 전달하는 코드 경로다. 현재 HTTP 경로에서는 도달하지 않으며 fake adapter 단위 테스트로만 검증한다. 키 자동 발급이나 실제 조회를 수행하지 않는다. MOCKCB는 비오프라인 검증에서 거부한다.
- 검증 결과에서는 거래번호와 CASE만 사용한다. 거래번호는 **우리가 0221에서 생성한** `healthway_requests.demand_dealings_no`와 일치해야 한다. 복호화된 이름·CI·생년월일·전화번호·이용자번호를 콜백 로그나 응답에 넣지 않는다.
- 한 트랜잭션 안에서 거래번호로 요청을 `FOR UPDATE` 조회하고 `checkLink()`로 만료·취소·철회를 검사한다. 요청이 정확히 하나이며 `auth_pending`, `callback_used_at IS NULL`이어야 한다. 그 외 상태·미등록 거래번호는 `409 replay`다.

| CASE | 공식 의미 | 현재 DEV 동작 / 페이지 |
|---|---|---|
| CASE1 | match, 미가입, mymdResult=200 | `processing` 전환·사용시각 저장 후 기존 `completeOfflineFlow` 실행. `200 성공` |
| CASE2 | match, 미가입, mymdResult≠200 | 요청을 소비하지 않고 `auth_pending` 유지. `200 재시도 필요` / retry_join_failed |
| CASE3 | match, 이미 활용서비스 가입 | CASE1과 동일하게 기존 offline 완료 흐름 실행. `200 이미 가입` |
| CASE4 | !match, 본인인증 실패/취소 | 요청을 소비하지 않고 `auth_pending` 유지. `200 재시도 필요` / retry_auth_failed |

CASE3의 DEV 결과는 이미 가입한 이용자도 연결·자료 수집을 진행하는 기존 offline 동작에 맞췄다. 기존 `completeOfflineFlow`는 **별도로 static SDK 0201 샘플을 읽는다**. 그 샘플의 거래번호나 CASE를 신규 콜백의 바인딩으로 사용하지 않으며, 서명된 DEV CASE와 샘플 CASE가 같다고 주장하지 않는다. 샘플 identity는 기존 흐름이 사용하는 범위에서만 암호화 저장한다. 기존 `/public/:token/mock-auth`의 nonce 검증·동작은 유지한다.

사용 처리는 외부 어댑터 호출 전에 커밋되므로 동시 콜백은 한 번만 완료할 수 있다. 완료 중 오류는 기존 흐름대로 `failed`가 되어 새 요청이 필요하다. `/start`의 DB 시도 상한(3회)도 유지한다. 기존 bearer 경로의 rate limit과 별도로 콜백 전용 제한을 적용한다.

페이지는 고정된 한국어 HTML만 반환하며 입력값·SDK 메시지·토큰을 출력하지 않는다. 성공 안내는 “연결 완료, 창을 닫고 설계사에게 알려주세요.”다. 처리 불가 페이지는 입력 오류 `400`, 상태 오류 `409`, provider 미설정 `503`, 예상치 못한 내부 오류 `500`에 사용한다. 공통 헤더는 `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`이며 CSP는 다음과 같다.

```text
default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'
```

## Rate limit

콜백은 메서드·입력 검증 및 DB/어댑터 작업 전에 클라이언트 IP 해시별로 60초 고정 창에서 최대 30개 요청을 허용한다. 31번째부터 `429 rate_limited`와 기존 HTML 스타일의 “처리 불가” 및 일반 안내 문구를 반환한다. GET 외 메서드와 잘못된 입력도 한도에 포함한다. Express의 `req.ip`(없으면 socket 주소)를 사용하며 프록시 헤더를 직접 신뢰하지 않는다.

인프로세스 Map은 최대 10,000키만 보관하며 만료 항목을 요청 시 제거한다. 키는 기존 IP 로그 해시를 재사용하고, 키 설정 오류 시에도 SHA-256 해시로 제한을 유지한다. 원본 IP는 Map에 저장하지 않는다. 가득 찬 경우 새 클라이언트는 `429`로 거부하고 DB 로그도 생략한다(미추적 키의 로그 폭증 방지). 기존 키의 남은 요청 한도는 유지된다.

동일 키·창에서 첫 제한 요청만 access 1행 + error 1행을 기록하며 이후 제한 요청은 DB에 기록하지 않는다. 따라서 한 키의 한 창에서 콜백 로그는 최대 62행이다. 콘솔은 제한 요청에도 기존 한 줄 형식을 유지한다. 제한 상태는 서버 재시작 시 초기화되며 다중 인스턴스 사이에 공유되지 않는다.

## DEV mock 절차

공식 offline SDK의 0201은 입력을 무시하고 고정 샘플을 반환한다. 따라서 새 DEV 콜백은 임의 암호문이나 그 샘플을 인증 근거로 받지 않는다. **DEV 전용 서명자**만 사용할 수 있다.

1. [OFFLINE_DEV.md](./OFFLINE_DEV.md)의 비운영 offline 설정과 로컬 DB·어댑터를 준비한다. `HEALTHWAY_TOKEN_SECRET_KEY`는 기존과 같은 32바이트 전용 키(hex 또는 base64)를 환경으로 주입한다. 저장소나 CLI 인수에 키를 쓰지 않는다.
2. 기존 화면에서 요청·동의·`/start`를 진행하여 `auth_pending` 상태와 생성된 `demandDealingsNo`를 얻는다.
3. 같은 환경 키를 사용하는 로컬 셸에서 아래 서명 스크립트를 실행한다. 기본 CASE는 CASE1이며 CASE1–CASE4를 지정할 수 있다.

```bash
node scripts/healthway/sign-mock-callback.mjs "$HEALTHWAY_DEV_DEMAND_DEALINGS_NO" CASE1
```

출력은 `/api/healthway/callback/cert?resultData=...` 상대 경로 하나다. 해당 로컬 앱 호스트에 붙여 브라우저로 연다. **출력 URL도 민감값으로 취급**하여 로그·이슈·커밋에 남기지 않는다. 스크립트는 키나 입력값이 포함된 오류 메시지를 출력하지 않는다.

형식은 `MOCKCB.<base64url(JSON)>.<hex HMAC-SHA256>`이다. JSON의 허용 필드는 `demandDealingsNo`, `exp`(Unix 초), `case` 세 개뿐이며 nonceHash 등 추가 필드는 거부한다. 키는 전용 tokenKey를 디코딩한 뒤 `HMAC-SHA256(tokenKey, "healthway:mock-callback:v1")`로 도메인을 분리하여 얻는다. 서명 대상은 `MOCKCB.<base64url(JSON)>` 전체다. 검증은 `timingSafeEqual`을 사용하며 만료는 검증 시점 이후여야 하며, 최대 유효기간 600초에 서명 기기의 빠른 시계 오차 60초를 허용한다(`exp <= now + 660`). 이미 만료된 값에는 오차를 허용하지 않는다. DEV 서명 스크립트는 300초(5분)로 발급한다. 비오프라인에서는 이 형식을 허용하지 않는다.

## 로그

모듈이 활성화된 경우에만 `ensureHealthwaySchema()`가 `healthway_callback_logs`를 `CREATE TABLE IF NOT EXISTS`로 만든다. 거래번호 조회 인덱스도 추가한다. 새 테이블은 다음 필드만 가진다.

| 필드 | 타입 / 내용 |
|---|---|
| id | TEXT, 로그용 UUID PK |
| received_at | TIMESTAMPTZ, 수신 시각 |
| level | TEXT, access 또는 error |
| outcome | TEXT, success / already_joined / retry_join_failed / retry_auth_failed / invalid_input / replay / provider_not_configured / verify_failed / internal_error / method_not_allowed / module_disabled / rate_limited |
| case_code | TEXT, 검증된 CASE1–CASE4 또는 NULL |
| error_code | TEXT, 고정된 내부 코드 또는 NULL. 외부 예외 내용은 사용하지 않음 |
| request_id | TEXT, 우리 요청 ID 또는 NULL. 거래번호를 저장하지 않음 |
| result_data_sha256 | TEXT, resultData의 SHA-256 hex 또는 미수신 시 NULL |
| result_data_length | INTEGER, 수신한 문자열 길이 |
| client_ip_hash | TEXT, tokenKey에서 IP용 라벨로 파생한 salt + IP의 SHA-256 hex |
| user_agent_hash | TEXT, 별도 UA용 라벨로 파생한 salt + User-Agent의 SHA-256 hex |
| duration_ms | INTEGER, 검증·완료 처리 시간(로그 INSERT 시간 제외) |

위 rate limit의 로그 생략 대상 외에는 각 콜백이 access 1행을 기록한다. 실패(재시도 CASE2/CASE4 포함)는 error 1행을 추가하며 두 행을 하나의 INSERT로 기록한다. 로그 DB 장애·테이블 미생성 시에는 응답을 유지한다. 키 설정이 잘못되어 client hash를 계산할 수 없으면 해당 hash는 NULL이다. 모듈 비활성 상태에서는 스키마가 생성되지 않으므로 로그 저장은 보장하지 않는다.

콘솔은 다음 고정 형태의 한 줄만 출력한다. rid는 resultData 해시 앞 8자리이며 원문·고객정보·거래번호가 아니다.

```text
[healthway-callback] outcome=<고정 코드> case=<CASE 또는 -> len=<길이> rid=<해시 앞 8자리 또는 ->
```

`server/index.js`의 기존 DB/보안 로그 경로는 callback URL의 쿼리를 제거한다. 전역 JSON 파서와 CORS 자동 preflight는 콜백을 건너뛰므로 잘못된 POST body도 새 all-method 핸들러에서 처리하며 일반 오류 로거로 보내지 않는다. 기존 애플리케이션에 요청 전체 URL을 출력하는 공통 request logger는 없다. 콜백 핸들러는 SDK/DB 예외의 message·stack·임의 code를 출력하지 않는다.

## 확인할 사항

- 공식 가이드는 브라우저 GET을 설명한다. 중계시스템이 별도로 POST도 전송하는지 확인해야 한다. 현재 POST는 405다.
- 실제 resultData URL 인코딩(percent encoding, `+` 처리 등)을 testbed에서 확인해야 한다. 현재 표준 query decoding만 사용하며 별도 변환이나 암호문 형식을 가정하지 않는다.
- 인바운드 IP allowlist 정책이 브라우저 리디렉션에도 적용되는지 확인해야 한다. 브라우저 IP를 중계시스템 서버 IP로 가정하지 않는다. Express trust proxy/IP 전달 설정도 별도 확인 대상이다.
- Railway 등 edge/access 로그가 query string을 저장할 수 있다. resultData는 암호화되어 있어도 민감값이다. 애플리케이션의 쿼리 제거만으로 edge 로그까지 제어되지는 않는다. 이번 작업은 Railway 설정을 변경하지 않았다.
- edge 및 Node HTTP parser의 URL/헤더 크기 제한이 먼저 작동하면 애플리케이션의 HTML·로그 대신 transport 오류(예: 431)가 발생할 수 있다. 16,384자 검사는 큰 요청을 허용하는 격리 HTTP 테스트로 검증했다. 배포 환경의 transport 한도는 별도로 확인해야 한다.
- 실제 provider 활성화, 키 보관·교체, 승인된 testbed 요청 바인딩, 실패 후 재시도/보상 정책, 다중 인스턴스 콜백 rate limit과 로그 보존·파기 정책은 후속 검증 대상이다. 현재 구현은 실제 본인인증이나 Production 활성화를 의미하지 않는다.

## 검증 명령

```bash
# 반드시 별도 비운영 로컬 DB를 사용한다. server/.env의 DB를 사용하지 않는다.
HEALTHWAY_TEST_DATABASE_URL="$LOCAL_TEST_DB_URL" node --test server/healthway/*.test.js
services/healthway-adapter/test.sh
npx vitest run src/features/healthway/components/healthway.test.tsx
npm run build
```

이번 검증: 격리 로컬 PostgreSQL을 사용한 Healthway Node 60개(신규 17개 포함), 기존 Healthway 웹 7개, Java 어댑터 assertions 43개, Vite build가 통과했다. 전체 `npm test`는 2,246 PASS / 27 FAIL이며, 같은 환경에서 기준 `a3ed530c`는 2,229 PASS / 27 FAIL이었다. 실패 제목의 multiset이 동일하여 신규 실패는 0개다. 전체 저장소 테스트가 green인 것은 아니다.
