# ONEFC_MOBILE_CARD_ROUND8_REAL_DEVICE_UX_FIXED

Development only. Production/main unchanged.

## Root cause

### A. Action bar 위로 치우침

- `.pap-action-bar` had asymmetric padding `6px 6px 10px` (top 6 / bottom 10).
- Previous QA measured only `.pap-action-bar__item` inner gaps, not bar-level `iconTop - barTop` vs `barBottom - labelBottom`.

### B. 신청하기 버튼 미표시

- Footer used shared `.pap-cta-row` (`flex-wrap: wrap`, `justify-content: center`, `margin-top: 20px`).
- On narrow mobile widths the primary button could wrap to a second row; combined with modal `overflow: hidden` and full-height sheet, the second row was clipped or appeared as “닫기 only”.
- Fix: `.pap-modal__footer--dual` 2-column grid, full-width buttons, explicit disabled opacity (not hidden).

### D. 개인정보 row 깨짐 (추가)

- `.pap-consult-privacy*` lived in `consultation-leads.css`, imported only on CRM `/consultation-leads`, **not** on public `/fc/:slug`.
- Fix: move privacy row styles into `public-advisor.css` (loaded on FC page).

### C. Keyboard / 과도한 스크롤

- `focusin` → `scrollIntoView({ block: 'nearest', behavior: 'smooth' })` fought mobile keyboard + `visualViewport` resize.
- Fix: remove `scrollIntoView`; adjust `scrollTop` only when field is outside `visualViewport` visible band.

## Code

- `public-advisor.css`: action bar symmetric padding, consult sheet `height: auto`, body `touch-action: pan-y`, footer grid.
- `consultModalKeyboardScroll.ts` + consult modal viewport chrome vars.
- `consultation-leads.css`: privacy row grid.

## QA

Post-deploy: 390×844 + Android Chrome for keyboard items. Desktop-only = UNVERIFIED for keyboard rows.
