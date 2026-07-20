# 보험 CRM 카카오 알림톡 환경변수 (Railway 수동 설정용 참고)

SMS(`ALIGO_*`, `SMS_MODULE_*`)·자동문자와 **완전히 분리**합니다.
아래 `INSURANCE_ALIGO_KAKAO_*` 키만 사용하세요. (정부지원 CRM / EC2 의 `ALIGO_KAKAO_*` 이름을 보험 코드에 그대로 넣지 않습니다.)

## 필수 env 목록

| 변수 | 기본 | 설명 |
|---|---|---|
| `INSURANCE_ALIGO_KAKAO_API_KEY` | (필수·실발송) | Aligo 알림톡 API Key |
| `INSURANCE_ALIGO_KAKAO_USER_ID` | (필수·실발송) | Aligo userid |
| `INSURANCE_ALIGO_KAKAO_SENDER_KEY` | (필수·실발송) | 카카오 채널 senderkey |
| `INSURANCE_ALIGO_KAKAO_SENDER` | (필수·실발송) | 발신번호(숫자) |
| `INSURANCE_ALIGO_KAKAO_DRY_RUN` | `true` | `true`면 provider HTTP 호출 없음 |
| `INSURANCE_ALIGO_KAKAO_ALLOW_REAL_SEND` | `false` | 전역 실발송 허용 |
| `INSURANCE_ALIGO_KAKAO_TEST_MODE` | `N` | Aligo `testMode` (`Y`/`N`) |
| `INSURANCE_ALIGO_KAKAO_TPL_CUSTOMER_APP_LINK` | `UJ_6184` | 고객앱 링크 템플릿 코드 |
| `INSURANCE_ALIGO_KAKAO_CUSTOMER_APP_LINK_APPROVED` | `false` | UJ_6184 검수 완료 후에만 `true` |
| `INSURANCE_ALIGO_KAKAO_TPL_CUSTOMER_REGISTRATION_LINK` | `UJ_6324` | 고객등록 링크 템플릿 코드 |
| `INSURANCE_ALIGO_KAKAO_CUSTOMER_REGISTRATION_LINK_APPROVED` | `false` | UJ_6324 검수 완료 후에만 `true` |

**secret 커밋 금지.** API Key / User ID / Sender Key 는 Railway(또는 로컬 `server/.env`)에만 둡니다.

## 정부지원 CRM ↔ 보험 CRM 매핑

정부지원은 Railway → EC2 relay, EC2 에 Aligo Kakao credential 이 있습니다.
보험 CRM 도 **Railway 직접 호출 시 Aligo IP 화이트리스트(-99)에 막히므로** EC2 relay 를 사용합니다.

| 정부지원 / EC2 | 보험 CRM |
|---|---|
| `ALIGO_KAKAO_API_KEY` | `INSURANCE_ALIGO_KAKAO_API_KEY` |
| `ALIGO_KAKAO_USER_ID` | `INSURANCE_ALIGO_KAKAO_USER_ID` |
| `ALIGO_KAKAO_SENDER_KEY` | `INSURANCE_ALIGO_KAKAO_SENDER_KEY` |
| `ALIGO_SENDER` (발신번호) | `INSURANCE_ALIGO_KAKAO_SENDER` |
| `ALIMTALK_DRY_RUN` / `GOVERNMENT_ALIMTALK_DRY_RUN` | `INSURANCE_ALIGO_KAKAO_DRY_RUN` |
| EC2 relay | `INSURANCE_ALIGO_KAKAO_GATEWAY_URL` + token (`SMS_MODULE_GATEWAY_TOKEN` 재사용 가능) |

### EC2 relay (필수 · production)

알리고 응답 `code -99` / `인증되지 않는 서버 IP로 부터의 호출 입니다.` 는 Railway egress IP 미등록이 원인입니다.

1. `sms-gateway-ec2` 에 `/api/crm-alimtalk` 라우트를 배포한다 (문자 CRM gateway 와 동일 프로세스).
2. Railway app env:

```
INSURANCE_ALIGO_KAKAO_GATEWAY_URL=http://100.54.92.161:3000/api/crm-alimtalk
# TOKEN 미설정 시 SMS_MODULE_GATEWAY_TOKEN 사용
INSURANCE_ALIGO_KAKAO_DRY_RUN=true
INSURANCE_ALIGO_KAKAO_ALLOW_REAL_SEND=false
```

3. diagnostics: `railway run --service app --environment production -- node server/scripts/diagInsuranceAlimtalkProfile.mjs`
   - `via: gateway`, `code: 0` 확인 후 1건 테스트 직전에만 real send 오픈.

보험 CRM 코드의 env 이름을 바꾸지 않습니다. 매핑은 운영 설정 시에만 적용합니다.

## 템플릿 A — 고객앱 링크 (`INSURANCE_CUSTOMER_APP_LINK`)

| 항목 | 값 |
|---|---|
| 카카오채널 | `@crm솔루션` |
| 템플릿명 | 고객앱 접속 링크 안내 |
| 템플릿코드 | `UJ_6184` |
| 상태 | 검수중이면 `*_APPROVED=false` |
| 대체문자 | 발송안함 (`failover=N`) — SMS fallback 없음 |

## 템플릿 B — 고객등록 링크 (`INSURANCE_CUSTOMER_REGISTRATION_LINK`)

| 항목 | 값 |
|---|---|
| 카카오채널 | `@crm솔루션` |
| 템플릿명 | 고객정보 등록 링크 안내 |
| 템플릿코드 | `UJ_6324` |
| 상태 | **검수중** → `*_APPROVED=false` |
| 대체문자 | 발송안함 (`failover=N`) |
| subject | 고객정보 등록 안내 |
| 버튼 | 고객정보 등록 |

## 승인 전 기본 차단값 (필수)

```
INSURANCE_ALIGO_KAKAO_DRY_RUN=true
INSURANCE_ALIGO_KAKAO_ALLOW_REAL_SEND=false
INSURANCE_ALIGO_KAKAO_TPL_CUSTOMER_APP_LINK=UJ_6184
INSURANCE_ALIGO_KAKAO_CUSTOMER_APP_LINK_APPROVED=false
INSURANCE_ALIGO_KAKAO_TPL_CUSTOMER_REGISTRATION_LINK=UJ_6324
INSURANCE_ALIGO_KAKAO_CUSTOMER_REGISTRATION_LINK_APPROVED=false
```

승인 flag 가 `false` 이면 **provider HTTP 호출 금지** (blocked / dry-run).

## 실발송 허용 조건 (모두 충족)

공통:
1. `INSURANCE_ALIGO_KAKAO_DRY_RUN=false`
2. `INSURANCE_ALIGO_KAKAO_ALLOW_REAL_SEND=true`
3. credentials 존재 (API Key / User ID / Sender Key / Sender)
4. 수신번호 정상
5. provider 응답 `code === 0` 만 성공 (`info.mid` = providerMessageId)
6. `failover=N`, SMS fallback 없음

고객앱 (`UJ_6184`) 추가:
- `INSURANCE_ALIGO_KAKAO_CUSTOMER_APP_LINK_APPROVED=true`
- `INSURANCE_ALIGO_KAKAO_TPL_CUSTOMER_APP_LINK=UJ_6184`
- 고객앱 링크 생성 성공

고객등록 (`UJ_6324`) 추가:
- `INSURANCE_ALIGO_KAKAO_CUSTOMER_REGISTRATION_LINK_APPROVED=true`
- `INSURANCE_ALIGO_KAKAO_TPL_CUSTOMER_REGISTRATION_LINK=UJ_6324`
- 고객등록 링크 생성 성공

## 승인 후 오픈 순서

1. 승인 본문·버튼명과 코드 `message_1` / button name 100% 일치 확인  
2. 해당 `*_APPROVED=true` 만 먼저 설정  
3. `ALLOW_REAL_SEND=true` 후 `DRY_RUN=false`  
4. 본인 번호로 1건씩 테스트 (고객앱 → 고객등록)  
5. `code === 0`, 버튼 링크, 로그 masking 확인  
6. 이상 없으면 운영 사용

## 1건 테스트 절차 (승인 전)

1. credentials·tpl·flag diagnostics (boolean / masked only)  
2. 고객앱 알림톡 버튼 → `dry_run` 또는 `blocked`, HTTP 없음  
3. 고객등록 발송 모달 → 카카오톡 발송 → `dry_run` 또는 `blocked`, HTTP 없음  
4. 로그에 API key / senderKey 원문 없음

## diagnostics 기대 (승인 전)

- credentials: true (설정 후)
- senderKey: true
- customerAppTplCode: `UJ_6184`
- customerRegistrationTplCode: `UJ_6324`
- dryRun: true
- allowRealSend: false
- customerAppApproved: false
- customerRegistrationApproved: false
- realSendEnabled: false

## 주의

- 검수 완료 전 `DRY_RUN=false` 금지 (Railway production 포함)
- SMS / 자동문자 env·코드와 혼용 금지
- secret 값은 문서·커밋·터미널 로그에 남기지 말 것
