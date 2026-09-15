# Customer detail UI scope

## Policy (2026-09-15)

고객 상세 UX 개선(Figma redesign, section quick edit, 알림일 Native UX, accordion/accent/전화·문자 plate 등)은 **ONE FC Native 앱(`insurance-mobile`) 전용**이다.

Platform(`insurance`)은 다음만 유지한다.

- Backend / API / DB (사업자, 화재보험 소재지, special dates, notification)
- 기존 운영 Web / Mobile Web 고객관리 UI (목록, 카드, 수정 폼, 기념일 UI)

Platform Web UI를 Native와 동일하게 맞추려면 사용자가 **명시적으로** `PC에도 적용` / `웹에도 적용`을 요청할 때만 변경한다.

## Native-only examples

- Section quick edit (자동차 / 사업자 / 화재 / 알림일)
- Figma customer detail redesign
- Section accent bar, typography plate
- Explicit save/discard / Android back / keyboard UX

## Platform keeps

- `businessInfo`, fire insurance locations API
- `customer_special_dates` + exact-date notification (`daysBefore: 0`)
- Kakao postcode hotfix, unrelated main hotfixes
- Selected customer preserve after edit (non-visual UX improvement)
