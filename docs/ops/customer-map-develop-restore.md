# 고객 지도 develop 복구 조사 (2026-06)

> **상태:** 조사·계획 문서. **코드 반영은 승인 후** cherry-pick 단위로 진행한다.  
> 배포 기준: `docs/ops/railway-deployment.md`

---

## 1. develop에서 지도가 빠진 원인

| 항목 | develop | main |
|---|---|---|
| `/customers/map` 라우트 (`appRouter.tsx`) | **없음** | 있음 (`2ede794`) |
| `CustomerMapPage` 및 map 컴포넌트 | **없음** | 20+ 파일 |
| `gaTenantMenu` 「고객 지도」 메뉴 | **없음** | `고객 지도(개발중)` |
| `server/apis/customerMapApi.js` 등 | **없음** | 있음 |
| `resolveViteNaverMapClientId.js` (env bridge) | **없음** | **없음** (feat만 있음) |

**원인 요약:** 지도 MVP는 `feat/customer-location-map-mvp`에서 개발된 뒤 **main에만 선별 단일 커밋 `2ede794`로 release** 되었다. develop에는 backport/cherry-pick이 없어 development URL(`develop` branch)에는 지도 코드가 전혀 없다.

---

## 2. 과거 정상 동작 후보 커밋

| 우선순위 | 커밋 | 설명 | develop | main | feat |
|:---:|:---|:---|:---:|:---:|:---:|
| **베이스** | `2ede794` | 지도 MVP (72파일 단일 release) | NO | YES | NO* |
| **필수** | `2a06ed1` | `NAVER_MAPS_CLIENT_ID` → Vite bridge | NO | NO | YES |
| UX | `ec186a8` | 헤더·미표시 패널 | NO | NO | YES |
| UX | `a8b0ef2` | 동일 좌표 그룹 마커·미표시 리스트 | NO | NO | YES |
| 안정화 | `e813178` | dynamic map 기본 렌더 | NO | NO | YES |
| 안정화 | `70c4dfd` | dynamic map SDK 로드 | NO | NO | YES |
| 안정화 | `d1f4675` | map callback·container sizing | NO | NO | YES |
| 안정화 | `b55b5ae` | viewport bounds 마커 | NO | NO | YES |
| 안정화 | `cef3af7` | 지도 복귀 시 마커 선택 | NO | NO | YES |
| 진입 | `e0184d2` | 목록·상세에서 지도 보기 | NO | NO | YES |
| 포커스 | `54ec1b8` | focus zoom 17 | NO | NO | YES |

\* `2ede794`는 main 단독 release 커밋으로 feat와 ancestry가 다름. feat 전체를 merge할 수 없음.

**권장 “정상” 기준:** feature tip `c9d6ea1` 직전 지도 UX 묶음 + env bridge. prod에서 “지도는 뜨나 Client ID/마커 UX 불완전”이면 **`2a06ed1` 누락** + main 대비 feat UX 커밋 누락이 원인 후보.

---

## 3. 정상 후보의 주요 파일

```
src/appRouter.tsx                          # customers/map 라우트
src/features/dashboard/gaTenantMenu.ts     # 메뉴 항목
src/features/customers/pages/CustomerMapPage.tsx
src/features/customers/pages/customer-map/*
src/features/customers/components/map/*
src/features/customers/hooks/useCustomerMapState.ts
src/features/customers/api/customerMapApi.ts
src/features/customers/config/customerMap.config.ts
server/apis/customerMapApi.js
server/lib/customerMapService.js
server/lib/customerMapQuery.js
server/lib/resolveViteNaverMapClientId.js   # feat only
vite.config.ts                             # env bridge (feat)
```

---

## 4. main `2ede794` vs feature 최신 지도 diff

- **main에만:** `2ede794` 단일 커밋 산출물 (static→dynamic 전환 포함 MVP)
- **feat에만:** `2a06ed1` env bridge, `ec186a8`/`a8b0ef2` 그룹 마커·미표시 패널, `e0184d2` 등 UX·안정화 20+ 커밋
- **공통 베이스 없음:** `git merge-base origin/develop origin/feat/customer-location-map-mvp` 없음 → 통째 merge 불가

`git diff origin/develop origin/main` — map 관련은 main 쪽에만 전체 트리 존재.

---

## 5. develop 반영 최소 커밋 목록 (승인 대기)

### Phase A — 베이스 (1커밋)

| # | 방법 | 내용 |
|---|---|---|
| A1 | `git cherry-pick 2ede794` onto develop | 지도 MVP 전체 파일 + 라우트 + 메뉴. 충돌 시 map 파일만 수동 해결 |

### Phase B — env bridge (1커밋, A와 분리)

| # | 커밋 | 내용 |
|---|---|---|
| B1 | `2a06ed1` | `resolveViteNaverMapClientId.js` + `vite.config.ts` |

### Phase C — UX·안정화 (선별 cherry-pick, 각각 별도 커밋 권장)

| # | 커밋 | 내용 |
|---|---|---|
| C1 | `ec186a8` | 헤더·미표시 패널 |
| C2 | `a8b0ef2` | 그룹 마커·미표시 리스트 |
| C3 | `cef3af7` | 지도 복귀 마커 선택 |
| C4 | `e0184d2` | 목록·상세 → 지도 (고객 중복 커밋과 분리 유지) |

> Phase C는 A 적용 후 development 실기기에서 부족한 항목만 선별.

### 금지

- `feat/customer-location-map-mvp` 통째 merge
- `c9d6ea1` (고객 id dedupe) 혼입 — **보류**
- geocode backfill execute — 별도 승인·clone DB

---

## 6. env bridge 필요 여부

**필요함 (권장).**  
main/prod에 `resolveViteNaverMapClientId.js` 없음. Railway `NAVER_MAPS_CLIENT_ID`만 설정 시 Vite 번들에 `VITE_NAVER_MAP_CLIENT_ID` 미주입 → Dynamic Map “설정 필요” 오류 가능.

---

## 7. 좌표 backfill 분리

| 현상 | 분류 |
|---|---|
| 지도 표시 2명 / 미표시 658명 | **lat/lng backfill 이슈** — 구조상 정상 |
| 임의 좌표·주소만으로 표시 | **금지** |
| `customer-geocode-backfill.mjs --execute` | **별도 승인**, development clone DB만 |

이번 복구 범위: 메뉴·라우트·SDK·env·UI. backfill은 포함하지 않음.

---

## 8. main/prod 반영 (승인 후)

1. develop Phase A~C 검증 완료
2. 검증된 커밋만 `main` cherry-pick (전체 develop merge 금지)
3. prod `/version.json` · `/customers/map` · health 확인

---

## 9. 검증 체크리스트 (development)

- [ ] 메뉴 「고객 지도(개발중)」 노출
- [ ] `/customers/map` 진입
- [ ] Naver SDK 로딩 (smoke: `/naver-map-smoke` 있으면 병행)
- [ ] Client ID env 인식
- [ ] 마커·미표시 카운트·미표시 패널
- [ ] 마커 카드 → 상세 → 지도 복귀
- [ ] PC/모바일
