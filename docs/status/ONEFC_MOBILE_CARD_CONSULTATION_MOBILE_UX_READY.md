# ONEFC_MOBILE_CARD_CONSULTATION_MOBILE_UX_READY (Round 7)

Development only. Production/main unchanged.

## Changes

- Action bar: item column `justify-content: center`, `min-height: 76px`, balanced padding
- 상담 modal: header / scroll body / fixed footer, `100dvh` + `visualViewport`, focus `scrollIntoView`
- 개인정보: inline row, privacy overlay z-index 60, body scroll lock, terms body scroll only
- Privacy: 취소 / 확인 (확인 → 동의 자동 체크)
- Back stack: `useBackButtonClose` (`pap-privacy-modal` → `pap-consult-modal` → page)
- ESC: privacy 우선, then consult

## QA captures (manual)

`01-action-bar-vertical-center.png` … `11-back-closes-consult-only.png` — 390px / 실기기

## tsc

`npm run tsc` PASS
