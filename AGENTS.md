# 에이전트 작업 규칙

이 저장소에서 AI 에이전트가 지켜야 하는 **배포/브랜치 규칙**입니다. 모든 세션에서 반드시 이 파일을 먼저 읽고 따를 것.

---

## 1. 브랜치 전략

| 브랜치 | 역할 | 배포 트리거 |
|---|---|---|
| `develop` | **기본 작업 브랜치**. 모든 기능·수정은 먼저 여기로. | 없음(테스트 전용) |
| `main` | **운영 반영 브랜치**. 푸시되는 순간 실제 배포. | Railway 웹 · GitHub Actions 데스크톱/모바일 OTA |

## 2. 커밋·푸시 워크플로 (엄격)

```
작업 → develop 커밋 → develop 푸시 → [여기서 멈춤]
                                        ↓
                        사용자가 "머지" 류 지시를 명시적으로 한 경우에만
                                        ↓
                    develop → main 머지(fast-forward) → main 푸시
```

### 반드시 지킬 것

- `main`은 **사용자의 명시적 지시**가 있을 때만 건드린다.
  - 해당되는 지시 예: "머지해줘", "main 머지 푸시", "배포해줘", "업데이트 반영해" 등.
  - 애매하면 먼저 물어본다. 임의로 merge 하지 않는다.
- 머지는 `--ff-only` 우선. 이력 분기가 발생하면 원인부터 조사한다.
- `main`에 직접 커밋 금지. 모든 변경은 develop을 경유한다.
- `git push --force` 류 명령은 **절대 금지**. 사용자가 명시적으로 요구해도 main/develop에는 force push를 하지 않는다.

## 3. main 푸시 시 자동으로 일어나는 일

main에 푸시되면 **동시에 3개 채널**이 갱신되므로, 머지 타이밍은 신중해야 한다.

1. **Railway(웹)** — `insurance-dev-production.up.railway.app` 등 웹 서비스 자동 재배포.
2. **Electron 데스크톱 앱** — `.github/workflows/deploy.yml`이 Windows exe 빌드 후 릴리스에 publish.
3. **모바일 OTA** — `mobile-ota.yml`, `customer-mobile-ota.yml`이 EAS Update 배포. 설계사 앱·고객 앱 모두.

## 4. 체크리스트 (작업 종료 전)

- [ ] develop에만 푸시했는가? (사용자가 머지를 요구하지 않았다면 여기서 종료)
- [ ] 머지 요청이 있었다면, develop이 main보다 앞서 있고 분기 없이 선형인가?
- [ ] 머지 후 main 푸시까지 완료했는가?
- [ ] 사용자에게 "어디에(develop/main) 무엇을 반영했는지" 명확히 보고했는가?

## 5. 커밋 메시지 규칙

Conventional Commits 기반. 한국어/영어 혼용 가능하지만 접두사는 영어.

```
feat(scope): 새 기능
fix(scope): 버그 수정
refactor(scope): 동작 변화 없는 구조 개선
chore(scope): 빌드·의존성·설정
docs(scope): 문서
```

`scope` 예: `customers`, `customers-pc`, `customers-mobile`, `auth`, `api`, `deploy`.

## 6. 라인 엔딩 주의

Windows 환경에서 `core.autocrlf=true`로 인해 `git status`에 수백 개 파일이 M으로 보이는 경우가 있다. 이는 대부분 **실제 내용 변경이 아닌 CRLF 경고**이므로 `git diff --ignore-cr-at-eol --name-only`로 실제 변경 파일만 추려서 명시적으로 `git add <파일>` 할 것. `git add .` 사용 금지(의도치 않은 대량 커밋 방지).

> **TODO(별도 단독 커밋)**: 프로젝트 루트에 `.gitattributes`(`* text=auto eol=lf` + 바이너리 지정)를 추가하고 `git add --renormalize .`로 일괄 재정규화한다. 수백 파일짜리 단독 커밋이어야 하며 기능 커밋과 섞지 않는다. 실행은 큰 릴리스 직후 조용한 시점에.

## 7. 작업 인프라

### 7-1. worktree

- `D:/workspace/insurance-main-sync` 는 **main 브랜치 전용 worktree**다. 본 저장소(`D:/workspace/insurance`)는 상시 develop에 머물게 하고, main 머지·푸시만 이 worktree에서 수행하기 위한 용도.
- 덕분에 develop 작업 도중 브랜치 스위칭 없이 main 반영이 가능하다. 함부로 삭제하지 말 것.
- 추가 worktree를 만들 경우 이 파일에 용도를 명기한다.

### 7-2. Cursor Project Rules

- 경로: `.cursor/rules/*.mdc` (신형 포맷)
- 각 `.mdc`는 상단 front matter로 `description` / `globs` / `alwaysApply` 지정. 레거시 `rules.json`·`.md` 금지.
- 예: `.cursor/rules/r2-storage.mdc` — R2 업로드 기본 경로 규칙.

### 7-3. EAS Update 채널

- `apps/mobile/eas.json`, `apps/customer-mobile/eas.json`에 정의된 **빌드 프로필 채널만 publish 대상**이다 (`development` / `preview` / `main`).
- `default` 채널처럼 구독하는 빌드가 없는 채널로 publish 하지 말 것. 도달 대상 없이 EAS API 호출만 낭비한다.

## 8. PC/Mobile UI 분리 규칙

> 제품 원칙: **"모바일은 앱처럼, PC는 웹처럼"**. 두 플랫폼은 같은 데이터/로직을 공유하지만 UI 레이어는 **서로 오염되지 않도록** 분리한다.

### 8-1. 현재 분리 상태(스냅샷)

| 페이지 | View 파일 분리 | modifier 클래스 |
|---|---|---|
| `CustomersPage` | ✅ PCView/MobileView | ✅ `.customers-page--pc/--mobile` |
| `ClaimRequestsPage` | ✅ PCView/MobileView | ✅ `.claim-requests-page--pc/--mobile` |
| `ApplicationPage` | ✅ PCView/MobileView | ⚠ modifier 미부착(추후 부착 대상) |
| `CustomerWorkspaceLayout` | ✅ LayoutPC/LayoutMobile | ⚠ modifier 미부착(추후 부착 대상) |
| 그 외 페이지(20+ 파일) | ❌ 단일 파일 내부에서 `useIsMobile` 분기 | ❌ 없음 |

완성도는 점진적으로 끌어올린다. 이 파일이 "진행 현황"을 반영한다.

### 8-2. 핵심 원칙 (신규·수정 코드에 적용)

1. **View 파일 분리 우선**  
   새 페이지는 반드시 다음 구조로 만든다.
   ```
   features/<feature>/pages/<page>Page.tsx          ← container(데이터·라우팅)
   features/<feature>/pages/<page>/<page>PCView.tsx ← PC 전용 UI
   features/<feature>/pages/<page>/<page>MobileView.tsx ← 모바일 전용 UI
   ```
   container 안에서 `useIsMobile()` 한 번만 호출해 `<PCView/>` 또는 `<MobileView/>` 하나만 렌더한다.

2. **CSS는 modifier 패턴 고정**  
   View의 최상위 요소에 다음 클래스를 부여한다.
   ```tsx
   <main className="page <page>-page <page>-page--pc page--with-back">...</main>
   <main className="page <page>-page <page>-page--mobile page--with-back">...</main>
   ```
   페이지 스코프 CSS는 반드시 이 modifier를 prefix로 사용한다.
   - 허용: `.customers-page--pc .customer-card__actions { ... }`
   - 금지: `.pc-root .customers-page .customer-card__actions { ... }` (신규 추가 금지)

3. **`.pc-root` / `.mobile-root` 신규 사용 금지**  
   전역 레이아웃(`AppWorkspaceLayout`, `AppLayout`, `ElectronTitleBar` 등 페이지 무관 공용 영역)에서만 허용. **페이지·기능 스코프에서는 새로 추가하지 않는다.** 기존 것은 마주칠 때마다 해당 페이지 modifier로 점진 이관한다.

4. **분리된 View 내부에서 `useIsMobile` 사용 금지**  
   `XXXPCView` 안에서 "이 요소만 모바일일 때..." 같은 예외를 만들지 않는다. 분기가 필요하다면 container로 올린다.

5. **공유 컴포넌트는 props로 분기**  
   같은 컴포넌트를 두 플랫폼이 모두 쓸 경우, 컴포넌트는 `variant="pc" | "mobile"` 같은 명시적 prop으로만 분기한다. 컴포넌트 내부에서 `useIsMobile()`을 호출해 스스로 판단하는 코드는 금지.

### 8-3. 신규 페이지 체크리스트

- [ ] `PageContainer` / `PagePCView` / `PageMobileView` 3파일 구조인가?
- [ ] 최상위 요소에 `*-page--pc` / `*-page--mobile` modifier를 붙였는가?
- [ ] 페이지 스코프 CSS가 **modifier prefix로만** 작성되었는가?
- [ ] View 내부에 `useIsMobile` 호출이 없는가?
- [ ] 공유 컴포넌트 내부에 `useIsMobile` 호출이 없는가? (있다면 prop으로 올림)

### 8-4. 기존 미분리 페이지 이관 가이드

당장 전부 분리하지 않는다. 다음 우선순위로 기회가 생길 때마다 옮긴다.

1. 해당 페이지를 기능적으로 수정할 일이 생기면 **함께** 분리 PR로 묶는다.
2. 분리 순서: (a) `PCView`/`MobileView` 파일 생성 → (b) container에서 `useIsMobile`로 분기 → (c) CSS를 modifier prefix로 재작성 → (d) 구 `.pc-root`/`.mobile-root` 규칙 삭제.
3. 한 PR에 한 페이지만 이관. 대량 리팩토링 PR은 회귀 범위 파악이 어려우므로 금지.

> **원칙**: "기능 작업이 없는데 UI 분리만을 위한 PR"은 만들지 않는다. 리팩토링은 항상 기능 변경과 함께 한다.
