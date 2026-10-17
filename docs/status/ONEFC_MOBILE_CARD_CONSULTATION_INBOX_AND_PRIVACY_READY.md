# ONEFC_MOBILE_CARD_CONSULTATION_INBOX_AND_PRIVACY_READY

Development (`develop`) only.

## 요약

| 영역 | 내용 |
|------|------|
| CRM | `/consultation-leads` — `advisor_consultation_leads` 전용 목록·상세·상태 변경 |
| API | `GET/PATCH /api/me/advisor-consultation-leads` (본인 `advisor_user_id`만) |
| 알림 | `advisor_consultation_lead` 클릭 → `/consultation-leads?lead={id}` |
| 메뉴 | USER `상담 신청` + 신규 건수 badge |
| 공개 상담 | 개인정보 수집·이용 동의 + 내용보기 modal, `privacy_policy_version` 저장 |
| UI | Action bar icon optical center, 전화/팩스 입력·로드 시 하이픈 SSOT |

## DB

- `advisor_consultation_leads`: `privacy_policy_version`, `checked_at`, `completed_at`, `status` default `new`

## QA

- E2E: 공개 상담 POST → CRM 목록 → 알림 클릭 → 상세
- 전화/팩스 편집기 입력 자동 하이픈
- QR/공유 회귀: `/profile/mobile-card`
