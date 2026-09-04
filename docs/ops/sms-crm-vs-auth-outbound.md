# CRM SMS / 인증 SMS / 알림톡 Outbound IP

> 운영 SSOT. 보험 CRM **모든 메시징**(인증 SMS · CRM SMS · 알림톡)은 Railway → Aligo direct.
> EC2 gateway env/code는 rollback 전용으로 유지 (안정화 후 cleanup).

## 경로

| 구분 | 경로 | Aligo ACL IP |
|------|------|----------------|
| **CRM 문자** | Railway → Aligo SMS API (`SMS_MODULE_PROVIDER=aligo`) | Railway Production Outbound Static IP 전부 |
| **운영 인증문자** | Railway → Aligo SMS API (`AUTH_SMS_PROVIDER=aligo`) | 동일 |
| **알림톡** | Railway → Aligo Kakao API (`INSURANCE_ALIMTALK_PROVIDER=aligo`) | **동일** (문자 API 신청/인증 화면 단일 allowlist) |

## Rollback (안정화 전)

| 구분 | Rollback env |
|------|----------------|
| CRM SMS | `SMS_MODULE_PROVIDER=aligo_gateway` |
| Auth SMS | `AUTH_SMS_PROVIDER=gateway` |
| 알림톡 | `INSURANCE_ALIMTALK_PROVIDER=gateway` |

## UI 표시

문자설정 화면 「현재 Railway 발송 서버 IP」는 `SMS_MODULE_OUTBOUND_IP_HINT`.
**문자·알림톡 API 공통** allowlist — EC2 IP 하드코딩 금지.

> 알리고 API의 발송 서버 IP 허용 목록에 아래 Railway Static IP를 모두 등록해 주세요.
> (인증문자 · CRM 문자 · 알림톡 동일 Railway direct 경로)

## Production cutover (알림톡)

1. SMS direct 안정화 확인 (회귀 금지)
2. `INSURANCE_ALIMTALK_PROVIDER=aligo` (gateway URL/token 유지)
3. redeploy + health
4. profile/list 또는 승인된 알림톡 1건 smoke
5. EC2 bypass 로그 확인 (`via: direct`)

상세: `docs/ops/railway-messaging-direct.md`, `docs/ops/ec2-messaging-audit.md`
