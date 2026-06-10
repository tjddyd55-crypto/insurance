# Railway 배포 기준 (단일 진실 원천)

> **최종 확정 (2026-06):** Railway Dashboard 기준과 동일하게 유지한다.  
> 변경 시 Railway 설정과 **이 문서·`AGENTS.md` §3** 을 함께 갱신한다.

---

## 1. 환경 ↔ 브랜치 ↔ URL

| 환경 | Railway Source Branch | URL | 배포 트리거 |
|---|---|---|---|
| **production** | `main` | https://insurance-production-7bd8.up.railway.app | `main` push |
| **development** | `develop` | https://insurance-dev.up.railway.app | `develop` push |

- **레거시 URL 금지:** `insurance-dev-production.up.railway.app` → 404. dev 검증은 `insurance-dev.up.railway.app` 만 사용.
- **feature 브랜치는 Railway에 직접 연결하지 않는다.** (`feat/*` → dev/prod 자동 배포 없음)

---

## 2. 작업 흐름

### 개발 (development 검증)

1. `feat/<topic>` 등 **feature 브랜치**에서 작업
2. `npm test` · `npm run build`
3. 작업 단위 커밋
4. **승인된 커밋만** `develop`에 merge 또는 cherry-pick
5. `develop` push → **Railway development** 자동 재배포
6. `https://insurance-dev.up.railway.app` 에서 실기기·PC 검증  
   - `/version.json` `buildId` 변경 확인  
   - `/backend/health` → 200

### 운영 (production 반영)

1. **development에서 정상 확인된 커밋만** 대상
2. 해당 커밋을 `main`에 **cherry-pick** (전체 `develop` → `main` merge **금지**)
3. `npm test` · `npm run build`
4. `main` push → **Railway production** 자동 재배포 (+ Electron·모바일 OTA는 `main` 전용)
5. `https://insurance-production-7bd8.up.railway.app`  
   - `/version.json` · `/backend/health` 확인  
   - 실기기 spot check

### 금지

- feature 브랜치를 Railway Source Branch로 설정
- 검증되지 않은 feature 커밋을 `main`에 포함
- `develop` 전체를 `main`에 통째로 merge (fast-forward 포함)
- Railway Source Branch 임의 변경 (변경 시 반드시 보고·문서 갱신)
- production DB·파괴적 스크립트를 development 검증 없이 실행

---

## 3. feature만 있는 커밋과 development URL

**development URL은 `origin/develop` HEAD만 반영한다.**

| 상황 | 결과 |
|---|---|
| 커밋이 `feat/*`에만 있음 | development URL에 **나타나지 않음** (정상) |
| development에서 확인하려면 | 해당 커밋을 **`develop`에 cherry-pick/merge** (승인 후) |
| production에 반영하려면 | development 검증 후 **`main`에 cherry-pick** (승인 후) |

feature 브랜치에만 있던 과거 배포(임시 source 연결)는 **폐지**되었다.  
과거 dev 번들에 feature 전용 코드가 보였더라도, 현재 기준은 **develop push 이후 빌드**만 유효하다.

---

## 4. 배포 확인 체크리스트

```bash
git fetch origin
git rev-parse origin/develop origin/main

curl -s https://insurance-dev.up.railway.app/version.json
curl -s https://insurance-production-7bd8.up.railway.app/version.json
curl -s https://insurance-dev.up.railway.app/backend/health
curl -s https://insurance-production-7bd8.up.railway.app/backend/health
```

| 확인 | development | production |
|---|---|---|
| Source branch | `develop` | `main` |
| health | 200 `{"ok":true}` | 200 `{"ok":true}` |
| buildId | push 후 변경됐는지 | cherry-pick·push 후 변경됐는지 |

`version.json`에는 git SHA가 없고 `buildId`(빌드 타임스탬프)만 있다.  
커밋 포함 여부는 `git branch -r --contains <sha>` 로 확인한다.

---

## 5. 관련 문서

- `AGENTS.md` §1–§3 — 에이전트·브랜치·파이프라인 규칙
- `docs/ops/database-environments.md` — dev/prod DB 분리
- `docs/ops/naver-maps-dynamic-map-setup.md` — 지도 env·도메인 (빌드 타임 `VITE_*`)
