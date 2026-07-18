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
| `INSURANCE_ALIGO_KAKAO_TPL_CUSTOMER_APP_LINK` | `UJ_6184` | 고객앱 링크 템플릿 코드 |
| `INSURANCE_ALIGO_KAKAO_CUSTOMER_APP_LINK_APPROVED` | `false` | UJ_6184 검수 완료 후에만 `true` |
| `INSURANCE_ALIGO_KAKAO_ALLOW_REAL_SEND` | `false` | 전역 실발송 허용. 검수 전 `false` 유지 |

템플릿 key: `INSURANCE_CUSTOMER_APP_LINK`

## 템플릿 정보 (UJ_6184)

| 항목 | 값 |
|---|---|
| 카카오채널 | `@crm솔루션` |
| 템플릿명 | 고객앱 접속 링크 안내 |
| 템플릿코드 | `UJ_6184` |
| 상태 | **검수중** |
| 대체문자 | 발송안함 (`failover=N`) |

```
INSURANCE_ALIGO_KAKAO_TPL_CUSTOMER_APP_LINK=UJ_6184
INSURANCE_ALIGO_KAKAO_DRY_RUN=true
INSURANCE_ALIGO_KAKAO_CUSTOMER_APP_LINK_APPROVED=false
INSURANCE_ALIGO_KAKAO_ALLOW_REAL_SEND=false
```

## 주의 (검수중)

- **검수 완료 전 `DRY_RUN=false` 금지** (Railway production 포함)
- 검수 완료 후 승인 본문과 `message_1`이 100% 일치하는지 확인
- 승인 완료 후 테스트 번호 1건만 실발송
- 운영 고객 대상 발송은 테스트 성공 후 진행
- Railway production env는 이 문서만으로는 변경하지 않습니다 (수동·승인 후)

## 실발송 조건 (모두 충족)

1. `DRY_RUN=false`
2. `CUSTOMER_APP_LINK_APPROVED=true`
3. `ALLOW_REAL_SEND=true`
4. `TPL_CUSTOMER_APP_LINK=UJ_6184` (또는 승인 코드)
5. API Key / User ID / Sender Key / Sender 설정
6. 고객 휴대폰·고객앱 링크·템플릿 변수 준비
7. provider `code === 0`
