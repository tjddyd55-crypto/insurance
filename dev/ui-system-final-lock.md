# UI SYSTEM FINAL LOCK (Phase 4)

## 목표

- 디자인 시스템을 **고정(Lock)** 해 팀 합의와 코드·Figma가 한 축으로 모이게 한다.
- 신규 개발 시 **테마·컴포넌트 우회로 인한 UI 붕괴**를 줄인다.
- **ESLint + UI Lock 스크립트**로 자동 검사를 걸고, 레거시는 **기능 수정 시 점진 제거**한다.

---

## 1. UI 사용 강제 규칙

### 금지

- **시맨틱 없이** `div` + `onClick` 등으로 버튼 역할만 내기 (접근성·포커스 링 부재).
- 폼에서 **의미 있는 입력**을 `Input` 대신 raw `<input>`만으로 반복 정의하기 (레이아웃·테마 일관성 파괴).
- **색상 직접 입력** (`#fff`, `#000`, `gray-*` 팔레트, `bg-white` / `text-black` 등).

### 필수

- 버튼·카드·필드·상태 표시: `src/components/ui/`의 **`Button`**, **`Card`**, **`Input`**, **`Badge`** 우선 사용.
- 색·배경·테두리: **`tokens.css` / `theme-tokens.css`의 `var(--*)`** 또는 Tailwind 확장 색 (`bg-bg`, `text-primary`, `border-border`, `text-success` 등).

### 검사 시 **수정 권장** 패턴 (예시)

```tsx
// 나쁜 예
<button className="bg-blue-500">...</button>
<div className="p-4 bg-white">...</div>
<input className="border-gray-300" />
```

```tsx
// 좋은 예
<Button variant="primary">...</Button>
<Card>...</Card>
<Input ... />
```

**참고:** `Button` 구현체 내부의 `<button>` 요소는 정상이다. 금지 대상은 **디자인 토큰·공통 컴포넌트를 우회한 야생 마크업**이다.

---

## 2. ESLint 강제 (`eslint.config.js`)

다음이 적용된다.

- **`no-restricted-syntax`**: 소스에 **히색 리터럴** (`#ffffff`, `#000` 등)이 문자열 리터럴로 남지 않도록 차단 (`src/**/*.{ts,tsx}` 한정).

프로젝트는 **Flat Config**이므로 별도 `.eslintrc`는 사용하지 않는다.

**예외:** 캔버스 서명·PDF 좌표 오버레이·이미지 내보내기 등 **픽셀 버퍼에 직접 쓰는 파일**은 `eslint.config.js`의 `ignores`로 이 규칙에서 제외된다. UI 크롬(레이아웃·폼)은 여전히 토큰을 쓴다.

---

## 3. UI Lock 스크립트 (`scripts/check-ui-lock.mjs`)

Tailwind **금지 클래스 조합** 등 ESLint만으로 잡기 어려운 패턴을 **grep 수준으로 차단**한다.

```bash
npm run lint:lock
```

- CI 또는 PR 전에 `npm run lint && npm run lint:lock` 권장.
- **예외**가 필요하면 해당 줄 바로 위에  
  `// ui-lock-ignore`  
  한 줄 주석을 단다 (스크립트가 해당 이유를 주석으로 인정하도록 구현됨).

---

## 4. 레거시 UI 점진 제거

| 대상 | 방향 |
|------|------|
| `style={{ color: '#…' }}` | `var(--*)` 또는 공통 클래스 |
| `gray-*`, `zinc-*` 남용 | 테마 색 유틸 |
| 오래된 페이지 전용 CSS | 공통 토큰·`components/ui`로 이동 |

**방법:** 버그 수정·기능 추가 시 **같은 PR에서 터치한 블록**부터 치환한다. 일괄 리라이트는 비용 대비 낮을 때만.

---

## 5. UI QA (수동 + 자동)

| 항목 | 확인 |
|------|------|
| 다크/라이트 | `data-theme` 전환 후 주요 플로우 |
| 버튼 | 기본·비활성·hover 대비 |
| Input | 포커스 링·placeholder 색 |
| 카드 | 배경·테두리·내부 타이포 |

자동: `npm run lint`, `npm run lint:lock`, `npm run build`.

---

## 6. 컴포넌트 확장 규칙

새 **재사용 UI**는 반드시 **`src/components/ui/`** 아래에 두고 `index.ts`에서 export.

예: `Modal.tsx`, `Table.tsx`, `Dropdown.tsx` — 이름·역할을 Figma 컴포넌트와 맞출 것.

---

## 7. Figma 동기화 (운영 원칙)

- **코드·토큰이 소스 오브 트루스(SSOT)** 이며, Figma는 이를 반영한다.
- **Figma만 먼저 바꾸고** 코드에 값을 맞추지 않는 **단방향 역전**은 금지(색·spacing·네이밍 불일치 방지).

---

## 8. LOCK 범위 (합의 후 변경 최소화)

다음은 **제품·브랜드 정책 변경 시에만** 의도적으로 바꾼다.

- `src/styles/tokens.css` **구조·핵심 이름**
- **색상 네이밍** (bg-main, text-primary, brand 등)
- **spacing 기준** (4px 그리드, Tailwind 기본 스케일)

일상적인 화면변경은 컴포넌트·레이아웃만 조정한다.

---

## 9. 완료 기준

- 주요 화면에서 **테마 전환 시** 구조적 깨짐 없음.
- 신규 코드는 **lint + lint:lock + build**를 통과.
- 레거시는 **점진 제거 계획**이 문서·리뷰에서 보인다.

---

## 10. 한 줄 요약

**“UI는 토큰과 `components/ui`로만 쌓는다. 나머지는 점진 철거.”**
