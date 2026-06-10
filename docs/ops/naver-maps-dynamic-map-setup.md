# NAVER Dynamic Map 설정 (고객 지도)

고객 지도 Dynamic Map에서 **「인증이 만료되었거나 유효하지 않습니다.」** 가 지도 위에 뜨면,
UI/CSS 문제가 아니라 **Naver Cloud Application 인증(키·도메인)** 문제일 가능성이 높습니다.

## 1. 키 종류 구분 (혼동 금지)

| 용도 | env | 노출 |
|---|---|---|
| 서버 Geocoding / Static Map | `NAVER_MAPS_CLIENT_ID`, `NAVER_MAPS_CLIENT_SECRET` | 서버 전용 |
| 브라우저 Dynamic Map | `VITE_NAVER_MAP_CLIENT_ID` | 프론트 빌드 타임 (public) |

- Geocoding Secret 은 **절대** `VITE_` 로 넣지 않습니다.
- Dynamic Map 은 NCP Console → Maps → Application 에서 **Web Dynamic Map** 상품이 선택된 Application 의 **Client ID** 를 `VITE_NAVER_MAP_CLIENT_ID` 로 넣습니다.
- 값이 Geocoding 과 같을 수 있으나, Application 에 Dynamic Map 이 활성화되어 있어야 합니다.

## 2. Railway env (development)

feature/dev 검증 시 **development `app` 서비스**에 아래가 있어야 합니다.

```
MAP_PROVIDER=naver
MAP_RENDER_MODE=dynamic
NAVER_MAPS_CLIENT_ID=...
NAVER_MAPS_CLIENT_SECRET=...
VITE_NAVER_MAP_CLIENT_ID=...   # Dynamic Map Client ID (ncpKeyId) — 프론트 단일 env 이름
VITE_MAP_PROVIDER=naver        # 선택, 미설정 시 naver 기본
```

- `VITE_NAVER_MAP_CLIENT_ID` 가 비어 있고 `NAVER_MAPS_CLIENT_ID` 만 있으면, Vite 빌드가 서버 키를 번들에 복사합니다(`server/lib/resolveViteNaverMapClientId.js`). **권장은 두 env 모두 동일 값으로 명시**하는 것입니다.
- env 추가·변경 후 **반드시 재배포**해야 Vite 번들에 반영됩니다.

## 3. Web 서비스 URL 등록 (가장 흔한 원인)

NCP Console → **Application Services → Maps → Application** → 해당 Application → **Web 서비스 URL**

아래 origin 을 **프로토콜 포함** 으로 등록합니다 (경로·포트 제외, 호스트만).

| 환경 | 등록 URL |
|---|---|
| Railway dev | `https://insurance-dev.up.railway.app` |
| Railway prod (향후) | `https://insurance-production-7bd8.up.railway.app` |
| 로컬 Vite | `http://localhost:5173` |

주의:

- `http` / `https` 를 실제 접속과 맞출 것
- dev 와 prod 는 **별도 등록**
- 레거시 `insurance-dev-production.up.railway.app` (404) 는 사용하지 않음
- FC 모바일 앱 WebView 는 **prod URL** (`insurance-production-7bd8.up.railway.app`) 로 접속 → prod 도메인도 등록 필요

## 4. script URL (코드 기준)

프론트는 아래 형식으로만 로드합니다.

```
https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId={VITE_NAVER_MAP_CLIENT_ID}&callback={...}
```

- `ncpClientId` (구 파라미터) 사용 금지
- 구 script 가 캐시되면 페이지 새로고침 또는 script 재삽입 로직(`mapSdkLoader.ts`)이 처리

## 5. 진단 방법

1. **Smoke 페이지**: `/naver-map-smoke` (로그인 불필요) — origin·script query·authFailure 여부 표시
2. 브라우저 Network: `maps.js` 200, `/v3/auth` 실패 여부
3. Console: `[customer-map] navermap_authFailure`, `naver map auth diagnostics`
4. 서버: `node server/scripts/naver-maps-smoke-test.mjs --all --railway-development` (Geocoding/Static)

## 6. production 선반영 체크 (feature 머지 전)

현재 production env 에는 `VITE_NAVER_MAP_CLIENT_ID` 가 없을 수 있습니다. feature 를 prod 에 올릴 때:

1. production `app` 에 `VITE_NAVER_MAP_CLIENT_ID` 추가
2. `MAP_RENDER_MODE=dynamic` (또는 feature 정책에 맞게)
3. NCP Web 서비스 URL 에 prod 도메인 등록
4. main 배포 후 재빌드

## 7. 관련 파일

- `src/features/customers/config/customerMap.config.ts` — provider / client key
- `src/features/customers/components/map/mapSdkLoader.ts` — script URL (`ncpKeyId`)
- `src/features/customers/config/naverMapSetupGuide.ts` — 등록 URL 목록·안내 문구
- `src/features/customers/pages/NaverMapSmokePage.tsx` — 인증 전용 smoke
