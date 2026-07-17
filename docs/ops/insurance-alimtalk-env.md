# 보험 CRM 카카오 알림톡 환경변수 (Railway 수동 설정용 참고)

SMS(`ALIGO_*`, `SMS_MODULE_*`)와 완전히 분리합니다.
아래 키만 사용하세요.

| 변수 | 기본 | 설명 |
|---|---|---|
| `INSURANCE_ALIGO_KAKAO_API_KEY` | (필수·실발송) | Aligo 알림톡 API Key |
| `INSURANCE_ALIGO_KAKAO_USER_ID` | (필수·실발송) | Aligo userid |
| `INSURANCE_ALIGO_KAKAO_SENDER_KEY` | (필수·실발송) | 카카오 채널 senderkey |
| `INSURANCE_ALIGO_KAKAO_SENDER` | (필수·실발송) | 발신번호(숫자) |
| `INSURANCE_ALIGO_KAKAO_DRY_RUN` | `true` | `true`면 HTTP 호출 없이 dry-run |
| `INSURANCE_ALIGO_KAKAO_TEST_MODE` | `N` | Aligo `testMode` (`Y`/`N`) |
| `INSURANCE_ALIGO_KAKAO_TPL_CUSTOMER_APP_LINK` | `PLACEHOLDER` | 고객앱 링크 템플릿 코드. placeholder면 실발송 금지 |

템플릿 key: `INSURANCE_CUSTOMER_APP_LINK`

실발송 조건 (모두 충족):
1. `DRY_RUN=false`
2. 승인된 `TPL_CUSTOMER_APP_LINK` (PLACEHOLDER 아님)
3. API Key / User ID / Sender Key / Sender 설정
4. 고객 휴대폰·고객앱 링크·템플릿 변수 준비
5. provider `code === 0`

이 문서만 추가하며, Railway production env는 임의 변경하지 않습니다.
