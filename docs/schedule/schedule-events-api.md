# 일정 관리 · Google Calendar 연동 API 계약

웹(PC·모바일)과 네이티브 앱은 같은 계약을 쓴다. 화면은 출처를 따로 집계하지 않고 서버가 정규화한 `ScheduleEvent` 만 그린다. Google 원본 payload 는 내려가지 않는다.

- 기준 시각: `Asia/Seoul`. 날짜 전용 값(`YYYY-MM-DD`)에는 시간대를 더하지 않는다. 오프셋 하드코딩 없이 `Intl` 로 계산한다.
- 1차는 **읽기 전용**. ONE FC → Google 생성·수정·삭제 없음. write scope 를 요청하지 않는다.
- Google 일정은 DB 에 미러링하지 않는다. 요청 시 조회 → 정규화 → 반환. 저장하는 것은 연결 상태와 암호화된 credential 뿐이다.

## 1. 소유 범위 (Integration Ownership SSOT)

| 항목 | 정책 |
|---|---|
| 소유자 | 현재 로그인 ONE FC 사용자. `owner_scope='USER'`, `user_id` = 세션 사용자, `ga_id IS NULL` |
| 저장 행 | `service_integrations` 의 `provider_key='google'` 한 행. Calendar 와 향후 Drive 가 같은 행을 쓰고 scope 만 늘린다 |
| 유일성 | 기존 부분 유니크 인덱스 `uq_service_integrations_user_provider (user_id, provider_key) WHERE owner_scope='USER'` |
| GA 공용·다른 사용자 fallback | 없음. 서버 전역 Google 계정 없음. 관리자·GA 관리자도 남의 Google 일정을 볼 수 없다 |
| 조회 | 모든 API 가 세션 `req.user.id` 로만 행을 찾는다. 요청 바디·쿼리의 id 로 찾지 않는다 |
| 캐시 | 메모리 60초, 키는 `google-events:{userId}:{calendarId}:{timeMin}:{timeMax}` / `google-calendars:{userId}`. 연결·교체·해제·재인증 필요 시 그 사용자 키만 지운다 |

## 2. Google OAuth (서버 중심)

```
브라우저 ─POST connect(Bearer)→ 서버: state(1회용, 10분, 사용자 바인딩) 저장 + HttpOnly 바인딩 쿠키
        ←{ url: accounts.google.com … }
브라우저 → Google 동의 → GET /backend/service-integrations/google/callback?code&state
서버: state 해시 조회·삭제(1회용) → 만료·provider·바인딩 쿠키 검증 → code 교환 → scope 확인 → userinfo
     → state 의 user_id 행에만 암호화 저장 → 302 /service-integrations?google=connected
```

- scope: `openid email profile https://www.googleapis.com/auth/calendar.readonly` (Drive·쓰기 없음). `include_granted_scopes=true` 로 이후 scope 추가 가능.
- refresh/access token 은 브라우저로 오지 않는다. localStorage 저장 없음. client secret 은 서버 env 에만 있다.
- credential 은 기존 암호화 SSOT(`smsCredentialsCrypto` AES-256-GCM, `SMS_CREDENTIALS_SECRET_KEY`)로 `credential_ciphertext` 한 칸에만 둔다.
- access token 만료 60초 전부터 refresh. Google 이 `invalid_grant` 를 주면 행을 `status='error', last_error='needs_reauth'` 로 표시.
- 같은 사용자가 다른 Google 계정으로 다시 연결하면 자기 행만 교체하고 이전 refresh token 을 revoke 한다.
- 연결 해제: revoke 시도 후 자기 행 삭제.

callback 오류 `reason`: `access_denied`, `state_invalid`, `state_expired`, `session_mismatch`, `scope_missing`, `refresh_token_missing`, `google_token_failed`, `google_unavailable`, `google_userinfo_failed`, `unconfigured`, `server_error`.

### 환경 변수 (값은 Railway 에만, 로그·응답 금지)

| 키 | 필수 | 설명 |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | 예 | Google Cloud OAuth 클라이언트(웹 애플리케이션) ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | 예 | 같은 클라이언트의 secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | 권장 | 없으면 `PUBLIC_BASE_URL` → `VITE_BASE_URL` origin + `/backend/service-integrations/google/callback` |
| `SMS_CREDENTIALS_SECRET_KEY` | 예(기존) | credential 암호화 키 |

승인된 리디렉션 URI:

- DEV: `https://insurance-dev.up.railway.app/backend/service-integrations/google/callback`
- PROD: `https://insurance-production-7bd8.up.railway.app/backend/service-integrations/google/callback`

## 3. Endpoints

모든 경로는 `/api` 와 `/backend` 아래 같다. callback 을 뺀 전부 `Authorization: Bearer` 필요(없으면 401).

| Method | Path | 설명 |
|---|---|---|
| GET | `/service-integrations` | 기존 카드 목록. `google_calendar` 카드는 아래 status 를 반영(`accountLabel`=email, `connectedAt`, `lastSyncedAt`=마지막 조회) |
| GET | `/service-integrations/google/status` | `{ provider, configured, status, accountEmail, displayName, connectedAt, lastFetchedAt, calendarReadable }`. `status`: `connected` \| `disconnected` \| `needs_reauth` \| `error`. 토큰 없음 |
| POST | `/service-integrations/google_calendar/connect` | `{ action: 'redirect', url }`. 미설정이면 409 `provider_unconfigured` |
| GET | `/service-integrations/google/callback` | Google 리디렉션 전용(Bearer 없음) |
| POST | `/service-integrations/google_calendar/disconnect` | 자기 연결 revoke + 삭제 |
| GET | `/service-integrations/google/calendars` | `{ calendars: GoogleCalendar[] }` |
| GET | `/service-integrations/google/events?start&end[&calendarIds=a,b]` | `{ start, end, calendars, events: ScheduleEvent[] }`. `calendarIds` 생략 시 기본 표시 캘린더 |
| GET | `/schedule/events?from&to[&sources][&calendarIds]` | 일정 관리 통합(CRM + Google) |

Google API 오류 code: `unconfigured`(409), `not_connected`(409), `needs_reauth`(409), `google_forbidden`(502), `google_unavailable`(502). 기간 오류 `invalid_range` / `range_too_wide`(400, 최대 400일).

### GoogleCalendar

```json
{ "id": "primary@example.com", "name": "내 캘린더", "primary": true, "accessRole": "owner",
  "timezone": "Asia/Seoul", "selected": true, "defaultVisible": true }
```

`defaultVisible = primary || selected`. 숨김(hidden)·삭제 캘린더는 뺀다. calendarList·events 모두 `nextPageToken` 을 따라간다(최대 10페이지 × 250).

## 4. ScheduleEvent (공통 모델)

| 필드 | 설명 |
|---|---|
| `id` | `google:{calendarId}:{eventId}` / `crm:{기존 알림 id}` |
| `source` | `google` \| `crm` |
| `sourceId` | Google event id / CRM 원천 id |
| `calendarId`, `calendarName` | Google 만. CRM 은 `null`, `''` |
| `type` | `google_event` \| `customer_alert`(알림일) \| `car_expiry` \| `insurance_age`(상령일) |
| `title`, `description` | 설명은 HTML 을 걷어낸 글자 |
| `startAt`, `endAt` | 종일: `YYYY-MM-DD`, `endAt` exclusive. 시간: RFC3339(오프셋 포함) |
| `allDay`, `timezone` | Google 은 event/캘린더 시간대, CRM 은 `Asia/Seoul` |
| `customerId`, `customerName` | CRM 만 |
| `location`, `status` | |
| `readOnly` | Google 항상 `true`. CRM 은 알림일만 `false`(기존 알림 수정 API) |
| `htmlLink` | `https://calendar.google.com/…` 또는 `https://www.google.com/calendar/…` 만, 아니면 `null` |
| `phone`, `sourceDate`, `sourceTitle` | 기존 알림 화면 호환 |

## 5. `/schedule/events`

`sources` 값(화면 칩): `google`(Google) · `customer_alert`(알림일) · `car_expiry`(자동차 만기) · `insurance_age`(상령일). 생략·`all` 은 전부.

CRM 은 알림 달력·전체 알림과 같은 `loadReminderSourceRows` + `assembleReminderEvents` 를 그대로 쓴다(쿼리 복제 없음).

```json
{
  "from": "2026-09-27", "to": "2026-11-07",
  "sources": ["google", "customer_alert", "car_expiry", "insurance_age"],
  "google": { "configured": true, "connected": true, "status": "connected", "calendars": [] },
  "events": []
}
```

`google.status`: `unconfigured` \| `disconnected` \| `connected` \| `needs_reauth` \| `error` \| `skipped`. Google 실패·재인증 필요여도 200 으로 CRM 일정을 돌려준다.

## 6. 화면 계약 (웹 · 네이티브 공통)

- 메뉴 `일정 관리`(`/schedule`, `/schedule/week`, `/schedule/day`, `/schedule/list`). 설정은 `서비스 연동`.
- 기간 단위로만 조회(월간 그리드 42일, 주 7일, 일 1일). polling 없음. 출처 필터는 받은 데이터에서 거른다.
- 미연동: `Google Calendar를 연결하면 일정을 함께 볼 수 있습니다.` + `서비스 연동으로 이동`.
- `needs_reauth`: Google 칩에 `재연결 필요`, 서비스 연동에서 `다시 연결`. CRM 일정은 그대로.
- 로그아웃 → 다른 계정 로그인 시 이전 사용자 Google 상태·일정을 표시하지 않는다(상태는 사용자 id 로 묶음).

## 7. 향후 확장 (지금 구현 안 함)

- 양방향: 같은 `ScheduleEvent` 의 `source/sourceId/calendarId` 로 쓰기 어댑터를 붙이고, 그때 `calendar.events` scope 를 incremental auth 로 추가한다.
- Drive: 같은 `provider_key='google'` 행에 scope 만 추가. 토큰 저장소를 새로 만들지 않는다.
- Naver: USER scoped, `user_id + provider_key` 가 SSOT.
