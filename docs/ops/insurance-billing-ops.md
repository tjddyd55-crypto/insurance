# Insurance Billing Operations (ONE FC)

> 운영 SSOT. Production 결제·구독 변경은 별도 승인 후에만 수행한다.

## 현재 아키텍처

| 항목 | 정책 |
|------|------|
| Provider | Toss Payments billing |
| Network I/O | **DB transaction 밖**에서 수행 (billing auth / charge API) |
| 결제 상태 | `pending` → provider callback / reconciliation으로 확정 |
| Identity 검증 | provider 응답의 customerKey·amount·orderId와 서버 기록 대조 |
| Duplicate 방지 | 결제 전 duplicate preflight (`billingPaymentDuplicatePreflight`) |
| Recovery | `billingChargeRecovery` worker / 수동 재시도 경로 |

## Production DB migration (미승인)

`billing_payments` 등에 대한 **production UNIQUE migration**은 아직 **승인 전**이다.

- dev/staging에서만 검증된 migration을 production에 적용하지 않는다.
- duplicate preflight는 application layer에서 우선 방어한다.

## 관련 코드

| 영역 | 파일 |
|------|------|
| API | `server/registerInsuranceBillingApi.js` |
| Transaction boundary | `server/insurance-billing/billingTransaction.js` |
| Auth boundary test | `server/insurance-billing/billingAuthTransactionBoundary.test.js` |
| Duplicate preflight | `server/scripts/billingPaymentDuplicatePreflight.mjs` |
| Renewal worker | `server/insurance-billing/insuranceBillingRenewalWorker.js` |
| Web checkout | `src/features/insurance-billing/` |

## 운영 금지 (현재)

- 승인 없는 production DB schema 변경
- reconciliation 없는 수동 결제 상태 override
- 테스트 카드/실결제 혼용 smoke

## 관련 문서

- `docs/ops/toss-live-cutover.md`
- `docs/ops/railway-deployment.md`
