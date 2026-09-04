# EC2 Messaging Dependency Audit (보험 CRM)

> 감사 시점: 알림톡 direct cutover 준비. EC2 인스턴스 terminate는 **별도 승인** 필요.

## EC2 역할 (100.54.92.161)

`sms-gateway-ec2/` — Express relay:

| Route | 용도 | Direct 전환 후 |
|-------|------|----------------|
| `POST /api/crm-sms/send` | CRM SMS (legacy) | **미사용** (`SMS_MODULE_PROVIDER=aligo`) |
| `POST /send-sms` | Auth SMS (legacy) | **미사용** (`AUTH_SMS_PROVIDER=aligo`) |
| `POST /api/crm-alimtalk/send` | 알림톡 | **cutover 후 미사용** (`INSURANCE_ALIMTALK_PROVIDER=aligo`) |
| `POST /api/crm-alimtalk/profile-list` | 프로필 진단 | cutover 후 미사용 |
| `POST /api/crm-alimtalk/template-list` | 템플릿 검수상태 | cutover 후 미사용 |

EC2는 **business logic 없음** — Aligo API form POST relay + Bearer token auth.

## Production env (rollback 유지)

| 변수 | 용도 | Direct 후 |
|------|------|-----------|
| `SMS_HTTP_GATEWAY_URL` | Auth SMS rollback | 유지 (미참조) |
| `SMS_MODULE_GATEWAY_URL` | CRM SMS rollback | 유지 (미참조) |
| `SMS_MODULE_GATEWAY_TOKEN` | Gateway Bearer | 유지 (알림톡 rollback 공유 가능) |
| `INSURANCE_ALIGO_KAKAO_GATEWAY_URL` | 알림톡 rollback | 유지 (미참조 when provider=aligo) |

## 코드 참조 분류

### A. SMS (direct 완료 — gateway fallback only)

- `server/services/smsService.js` — `AUTH_SMS_PROVIDER=gateway` 시만 EC2
- `server/sms/providers/gatewaySmsProvider.js` — `SMS_MODULE_PROVIDER=aligo_gateway` 시만

### B. 알림톡 (direct 준비 완료)

- `server/alimtalk/alimtalkProvider.js` — `useGateway=false` 시 direct
- `server/alimtalk/alimtalkConfig.js` — `INSURANCE_ALIMTALK_PROVIDER`

### C. 기타 보험 CRM

- `server/lib/customerGeocodingKakao.js` — `KAKAO_REST_API_KEY` (지오코딩, EC2 무관)

### D. Legacy / docs / smoke only

- `sms-gateway-ec2/**` — 참고 구현 + EC2 배포 스니펫
- `docs/ops/insurance-alimtalk-env.md` — EC2 relay 문구 (direct로 갱신 중)
- `server/scripts/*Smoke.mjs` — rollback env 존재 확인용

## EC2 종료 조건 (`EC2_MESSAGING_DEPENDENCY_ZERO`)

- [x] Auth SMS direct (`AUTH_SMS_PROVIDER=aligo`)
- [x] CRM SMS direct (`SMS_MODULE_PROVIDER=aligo`)
- [ ] 알림톡 direct (`INSURANCE_ALIMTALK_PROVIDER=aligo`) + 운영 1건 검증
- [x] Failover SMS 없음 (`failover=N` 전 템플릿)
- [ ] Production 24h+ 모니터링에서 EC2 API 호출 0
- [ ] env dependency cleanup (별도 phase)
- [ ] 동일 EC2에 **다른 서비스**(정부지원 CRM 등) 없음 확인 — **운영자 확인 필요**

**AWS terminate는 위 전부 + 타 서비스 0 확인 후 사용자 승인.**
