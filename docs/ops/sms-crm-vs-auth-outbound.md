# CRM SMS vs 인증 SMS Outbound IP

> 운영 SSOT. 인증문자 gateway 와 CRM 문자 Aligo 경로를 혼동하지 말 것.

## 경로 분리

| 구분 | 경로 | Aligo ACL에 필요한 IP |
|------|------|------------------------|
| **CRM 문자 모듈** (`/sms/**`, 즉시/예약/자동/그룹) | Railway `app` → Aligo API (`SMS_MODULE_PROVIDER=aligo`) 또는 EC2 gateway (`gateway`/`aligo_gateway`) | **direct 시** Railway Outbound Static IP 전체 |
| **운영 인증문자** (가입/비번재설정/전화변경/계정초기화) | Railway → `SMS_HTTP_GATEWAY_URL` (EC2) → Aligo | **EC2 Elastic IP** (현재 `100.54.92.161`) |
| **알림톡** | Railway → `INSURANCE_ALIGO_KAKAO_GATEWAY_URL` (EC2) | EC2 IP |

## UI 표시

문자설정 화면의 「현재 CRM 발송 서버 IP」는 env:

`SMS_MODULE_OUTBOUND_IP_HINT` (또는 `SMS_OUTBOUND_IP_HINT`)

의 다중 IP 목록이다. 하드코딩하지 않는다.

## Production cutover (CRM direct)

1. Railway Production Static Outbound IP enable + redeploy
2. Aligo 발송 서버 IP 허용 목록에 **Production IP 전부** 등록
3. `SMS_MODULE_OUTBOUND_IP_HINT=<ip1>,<ip2>,<ip3>`
4. `SMS_MODULE_PROVIDER=aligo` (gateway URL/token 은 auth·rollback 용으로 유지)
5. smoke: CRM 즉시발송 1건 (승인 후) + 인증문자는 gateway 유지 확인

EC2 를 먼저 끄지 않는다.
