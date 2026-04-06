# DESIGN SYSTEM FINAL (Phase 3 - 완성 단계)

## 목표

- Figma ↔ 코드 명명·토큰 기준 100% 정렬
- 색상 / 간격 / 타이포 / 컴포넌트 표준화
- 신규 기능 개발 시 테마·간격 불일치 최소화

---

## 1. 디자인 토큰 구조 (SSOT)

**파일:** `src/styles/tokens.css`

- 라이트: `:root`
- 다크: `:root[data-theme='dark']` (`colorScheme.ts`가 `document.documentElement`에 `data-theme` 설정)
- 레거시 별칭: `--primary`, `--brand`, `--text-main`, `--text-sub`, `--border` 등은 기존 `theme-tokens.css`·컴포넌트와 호환되도록 tokens에서 연결

**Import 순서:** `src/index.css`에서 `theme-tokens.css` 다음에 `tokens.css`를 두어, 동일 키는 Phase 3 SSOT 값이 최종 적용됩니다.

---

## 2. Tailwind 통합

프로젝트는 **Tailwind v4** (`@tailwindcss/vite`)를 사용합니다.

- **확장 색상:** `tailwind.config.js`의 `theme.extend.colors`
- **로드:** `src/index.css` 상단 `@config "../tailwind.config.js";`

**권장 클래스 예:**

| 의도        | 예시 class |
|-------------|------------|
| 페이지 배경 | `bg-bg`    |
| 카드 배경   | `bg-elevated` |
| 본문 텍스트 | `text-primary` |
| 보조 텍스트 | `text-secondary` |
| 테두리      | `border-border` |
| 브랜드 강조 | `text-brand`, `bg-brand` |
| 성공/위험   | `text-success`, `text-danger` |

직접 `var(--…)`를 써도 되며, 위 유틸과 혼용 가능합니다.

---

## 3. 타이포 시스템

**파일:** `src/styles/typography.css`

- `.h1`, `.h2`, `.body`, `.caption` — 기본 스케일 고정
- `.caption` 색: `var(--text-secondary)`

---

## 4. 간격 (Spacing)

- 기준: **4px** 그리드 (Tailwind 기본 스케일)
- `p-1`=4px, `p-2`=8px, `p-3`=12px, `p-4`=16px
- 가능하면 **임의 `style={{ padding: 13 }}` 지양** — 레이아웃은 Tailwind spacing 또는 공통 컴포넌트

---

## 5. 컴포넌트 규칙

**지양:** 불필요한 래퍼 `div`, 인라인 스타일, 화면·컴포넌트에 색상 하드코딩

**우선 사용:** `src/components/ui/` — `Button`, `Card`, `Input`, `Badge`

---

## 6. Figma 구조 (권장)

```
Design System
 ├ Colors   (bg-main, bg-elevated, text-primary, text-secondary, border, brand, success, danger)
 ├ Typography
 ├ Spacing
 └ Components (Button, Card, Input, Table, Modal …)
```

코드 토큰·컴포넌트 **이름을 Figma와 동일**하게 유지합니다.

---

## 7. 개발 ↔ 디자인 매핑 (예)

| Figma      | Tailwind (本项目)   |
|------------|---------------------|
| bg-main    | `bg-bg`             |
| text-primary | `text-primary`    |
| border     | `border-border`     |

---

## 8. 상태 UI

**지양:** `text-green-500`, `text-red-600` 등 팔레트 하드코딩

**권장:** `text-success`, `text-danger` 또는 `className="badge-success"` / `badge-danger`

---

## 9. QA 체크리스트

- [ ] 다크/라이트 동일 정보 구조·대비
- [ ] 버튼 hover·포커스 링
- [ ] input 포커스·placeholder
- [ ] 좁은 뷰포트 레이아웃
- [ ] 신규 코드에 색상 리터럴·gray 계열 남용 없음

---

## 10. 완료 기준

- 토큰·유틸·UI 컴포넌트로 화면을 구성할 수 있을 것
- 스타일 결정이 한곳(`tokens.css` + Tailwind theme)으로 수렴할 것
