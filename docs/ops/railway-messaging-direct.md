# Railway Messaging Direct Architecture (ONE FC 보험 CRM)

> SMS·알림톡 모두 Railway Production → Aligo API direct.
> EC2 gateway는 rollback 전용으로 env/code 유지 (안정화 후 별도 cleanup).

## 경로 요약

| 채널 | Before | After | Provider env |
|------|--------|-------|----------------|
| Auth SMS | Railway → EC2 `/send-sms` → Aligo | Railway → Aligo direct | `AUTH_SMS_PROVIDER=aligo` |
| CRM SMS | Railway → EC2 `/api/crm-sms` → Aligo | Railway → Aligo direct | `SMS_MODULE_PROVIDER=aligo` |
| 알림톡 | Railway → EC2 `/api/crm-alimtalk` → Aligo/Kakao | Railway → `kakaoapi.aligo.in` direct | `INSURANCE_ALIMTALK_PROVIDER=aligo` |

## Aligo IP ACL

문자 API · 알림톡 API 모두 Aligo **문자 API → 신청/인증 → 발송 서버 IP 허용 목록**을 공유한다.
SMS direct가 Railway Static IP 3개로 성공했다면, 동일 IP가 알림톡(`kakaoapi.aligo.in`)에도 적용된다.

Production Railway Outbound Static IP:

- `162.220.232.251`
- `152.55.177.181`
- `152.55.177.193`

UI 표시: `SMS_MODULE_OUTBOUND_IP_HINT` (문자설정 화면)

## 알림톡 구현 SSOT

| 레이어 | 파일 | 역할 |
|--------|------|------|
| Config | `server/alimtalk/alimtalkConfig.js` | credential, provider, dry-run, template flags |
| Transport | `server/alimtalk/alimtalkProvider.js` | send (direct form POST 또는 gateway JSON relay) |
| Template status | `server/alimtalk/alimtalkTemplateStatus.js` | `template/list` (direct/gateway) |
| Profile diag | `server/alimtalk/alimtalkProfileDiagnostics.js` | `profile/list` (direct/gateway) |
| Business | `server/alimtalk/alimtalkService.js`, `claimReceivedAlimtalk.js`, `customerRegistrationCompletedAlimtalk.js` | OTP/링크/청구/등록 완료 이벤트 |

EC2 gateway(`sms-gateway-ec2/routes/crmAlimtalk.mjs`)는 **단순 relay** — payload 변환 없이 Aligo API로 form POST.

## Failover SMS

현재 모든 알림톡 템플릿은 `failover=N` (대체문자 없음).
향후 failover 필요 시 **기존 Railway SMS direct** (`smsService` / `aligoSmsProvider`) 재사용. EC2 SMS gateway 사용 금지.

## Rollback

| 채널 | Rollback |
|------|----------|
| Auth SMS | `AUTH_SMS_PROVIDER=gateway` |
| CRM SMS | `SMS_MODULE_PROVIDER=aligo_gateway` |
| 알림톡 | `INSURANCE_ALIMTALK_PROVIDER=gateway` (gateway URL/token 유지) |

## 개인 사용자 Aligo 설정 (CRM 문자)

`/sms` 모듈의 per-user Aligo credential UI는 **유지**. 알림톡은 `INSURANCE_ALIGO_KAKAO_*` 중앙 credential (테넌트 공통).
