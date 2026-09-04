# CRM SMS / 인증 SMS Outbound IP

> 운영 SSOT. 보험 CRM의 **모든 SMS**(인증·CRM)는 Railway → Aligo direct.
> 알림톡만 EC2 gateway를 유지한다.

## 경로

| 구분 | 경로 | Aligo ACL에 필요한 IP |
|------|------|------------------------|
| **CRM 문자** (`/sms/**`, 즉시/예약/자동/그룹) | Railway `app` → Aligo API (`SMS_MODULE_PROVIDER=aligo`) | **Railway Production Outbound Static IP 전부** |
| **운영 인증문자** (가입/비번재설정/전화변경/계정초기화) | Railway → Aligo direct (`AUTH_SMS_PROVIDER=aligo`) | **동일 Railway Production Outbound Static IP** |
| **알림톡** | Railway → `INSURANCE_ALIGO_KAKAO_GATEWAY_URL` (EC2) | EC2 IP |

## Rollback (안정화 전)

| 구분 | Rollback env |
|------|----------------|
| CRM | `SMS_MODULE_PROVIDER=aligo_gateway` (+ gateway URL/token 유지) |
| Auth | `AUTH_SMS_PROVIDER=gateway` (+ `SMS_HTTP_GATEWAY_URL` 유지) |

gateway 코드/env는 1차 전환에서 **삭제하지 않는다**. 안정화 후 별도 cleanup.

## UI 표시

문자설정 화면의 「현재 발송 서버 IP」는 env:

`SMS_MODULE_OUTBOUND_IP_HINT` (또는 `SMS_OUTBOUND_IP_HINT`)

의 다중 IP 목록이다. EC2 IP를 하드코딩하지 않는다.

안내 문구:

> 알리고 문자 API의 발송 서버 IP 허용 목록에 아래 Railway Static IP를 모두 등록해 주세요.
> (인증문자·CRM 문자 모두 동일 Railway → Aligo direct 경로)

## Production cutover

1. Aligo 발송 서버 IP 허용 목록에 **Production Outbound IP 3개 전부** 등록
2. `SMS_MODULE_OUTBOUND_IP_HINT=<ip1>,<ip2>,<ip3>`
3. `SMS_MODULE_PROVIDER=aligo`
4. `AUTH_SMS_PROVIDER=aligo`
5. redeploy + health
6. smoke: 인증문자 1건 + CRM 즉시발송 1건 (테스트 번호만)

EC2 인스턴스 자체는 알림톡 때문에 끄지 않는다.
