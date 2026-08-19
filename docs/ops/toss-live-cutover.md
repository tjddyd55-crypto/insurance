# Toss LIVE 전환 runbook

production은 코드상 `provider=toss` + payment_settings `mode`/`client`/`secret` 으로 결제 환경을 바꾼다.
LIVE 전환 시 **코드 재배포는 필요 없다.** TEST billingKey를 LIVE secret으로 charge하지 않는다.

## TEST virtual (현재 목표)

- Railway: `INSURANCE_BILLING_PROVIDER=toss`
- `payment_settings`: provider=toss, mode=virtual, TEST `test_ck_` / `test_sk_`, enabled
- renewal worker: 운영 구조 ON 가능 (실제 출금 0, DB lifecycle은 실제)
- `[TEST] Toss 결제 QA` UI / Test-Code: **production runtime 금지**

## TEST → LIVE 순서

1. `INSURANCE_BILLING_RENEWAL_WORKER_ENABLED=false` 후 재배포/재시작
2. Admin billing settings **한 요청**으로 atomic 저장:
   - mode=`live`
   - client=`live_ck_...`
   - secret=`live_sk_...`
   - prefix mismatch면 저장 reject (기존 TEST 설정 유지)
3. diagnostics: provider=toss, mode=live, keys configured
4. 본인 계정 **LIVE 카드 재등록** (TEST billingKey 재사용 금지, `issued_mode` mismatch skip)
5. LIVE 결제 1건 확인
6. worker `true` 후 tick 확인

`PAYMENT_SETTINGS_SECRET_KEY` 는 암호화 SSOT. 데이터 암호화 후 임의 교체 금지.
