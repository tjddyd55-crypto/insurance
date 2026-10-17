# ONEFC_HERO_PHOTO_OG_AND_CONSULTATION_MOBILE_UX_DEPLOYED

Development only. Production/main unchanged.

## Git / Railway

| Field | Value |
| --- | --- |
| Commit SHA (HEAD) | `bc45c04dfd09690a4d25864a5fec867dd5239cd4` |
| OG commit | `eb5585c7` fix(public-advisor): use hero photo for og thumbnail |
| UX commit | `bc45c04d` fix(public-advisor): improve mobile consultation modal ux |
| origin/develop | `bc45c04d` (matches local HEAD) |
| Railway Dev `version.json` gitCommitSha | `bc45c04dfd09690a4d25864a5fec867dd5239cd4` |
| buildId | `1792250029703` |

## QA summary (2026-04-18)

| Item | Result |
| --- | --- |
| tsc | PASS |
| og:image `?v=` | PASS (`v=1792246039719` for tjddyd55) |
| Hero Photo OG | PASS (1200×630 PNG, blur+portrait) |
| 카드형 OG 제거 | PASS (no SVG text/theme overlay in renderer) |
| OG cache header | PASS (`max-age=3600, stale-while-revalidate=86400`) |
| Kakao debugger / 새 공유 | **수동** (팀 확인 필요) |
| Action icon 중앙 | PASS (topGap=8, bottomGap=8, diff=0 @390px) |
| Consult modal UX | PASS (a11y tree + back stack) |
| 상담 POST regression | PASS (`201`, lead id `a0e2864a-51e1-410b-8a9e-cbf1b755c003`) |
| 상담 메뉴 CRM | **수동** (로그인 필요) |

## Captures (local)

`scripts/qa/screenshots/hero-og-consult-deploy/`

- `01-og-meta-versioned.html`
- `02-og-hero-photo-direct.png`
- `03-action-bar-centered.png`
- `07-consult-footer-buttons.png`
- `10-privacy-cancel-confirm.png`

## Manual follow-up

1. [Kakao Sharing Debugger](https://developers.kakao.com/tool/debugger/sharing) → `/fc/tjddyd55` 재수집
2. CRM `/consultation-leads`에서 신규 lead·상태 변경·알림 딥링크 확인
