# ONEFC_PUBLIC_ADVISOR_THREE_MOBILE_CARD_DESIGNS_READY

Development only — `/fc/:slug` 단일 URL, `profile_theme`으로 Hero 3종 선택.

| Theme | Component | 인상 |
|-------|-----------|------|
| `classic` (default) | `AdvisorProfileHeroClassic` | 상단부터 큰 빌보드 인물사진 + 미니홈피 |
| `brand` | `AdvisorProfileHeroBrand` | ONE FC blue + 원형 사진 겹침 |
| `premium` | `AdvisorProfileHeroPremium` | 큰 사진 + navy gradient overlay, 액션바 아래 태그 |

- CRM: `/profile/public-advisor` → 실제 Hero 축소 미리보기 + 390px 모달
- NULL/unknown → `classic`
- 하단 섹션 공통 (`PublicAdvisorProfilePage`)

## QA captures (390px)

`node scripts/qa/capture-three-mobile-card-designs.mjs`  
→ `scripts/qa/screenshots/three-mobile-card-designs/`

- `01-classic-hero.png`
- `02-brand-hero.png`
- `03-premium-hero.png`
- `04-theme-picker.png`
