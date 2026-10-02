# 일정 관리 · Google Calendar·Tasks 연동 API 계약

웹(PC·모바일)과 네이티브 앱은 같은 계약을 쓴다. 화면은 출처를 따로 집계하지 않고 서버가 정규화한 `ScheduleEvent`(시간·종일 일정)와 `ScheduleTask`(할 일)만 그린다. Google 원본 payload 는 내려가지 않는다.

- 기준 시각: `Asia/Seoul`. 날짜 전용 값(`YYYY-MM-DD`)에는 시간대를 더하지 않는다. 오프셋 하드코딩 없이 `Intl` 로 계산한다.
- **읽기 전용**. ONE FC → Google Calendar·Tasks 생성·수정·완료 처리·삭제 없음. write scope(`…/auth/calendar`, `…/auth/tasks`)를 요청하지 않는다.
- Google 일정·할 일은 DB 에 미러링하지 않는다. 요청 시 조회 → 정규화 → 반환. 저장하는 것은 연결 상태와 암호화된 credential 뿐이다.

## 1. 소유 범위 (Integration Ownership SSOT)

| 항목 | 정책 |
|---|---|
| 소유자 | 현재 로그인 ONE FC 사용자. `owner_scope='USER'`, `user_id` = 세션 사용자, `ga_id IS NULL` |
| 저장 행 | `service_integrations` 의 `provider_key='google'` 한 행. Calendar·Tasks(향후 Drive)가 같은 행을 쓰고 scope 만 늘린다. Tasks 용 두 번째 연결 없음 |
| 유일성 | 기존 부분 유니크 인덱스 `uq_service_integrations_user_provider (user_id, provider_key) WHERE owner_scope='USER'` |
| GA 공용·다른 사용자 fallback | 없음. 서버 전역 Google 계정 없음. 관리자·GA 관리자도 남의 Google 일정을 볼 수 없다 |
| 조회 | 모든 API 가 세션 `req.user.id` 로만 행을 찾는다. 요청 바디·쿼리의 id 로 찾지 않는다 |
| 캐시 | 메모리 60초, 키는 `google-events:{userId}:{calendarId}:{timeMin}:{timeMax}` / `google-calendars:{userId}` / `google-tasklists:{userId}` / `google-tasks:{userId}:{taskListId}:due-any:status-all`. 연결·교체·해제·재인증 필요 시 `clearGoogleUserCache(userId)` 가 그 사용자 키(Tasks 포함)만 지운다 |

## 2. Google OAuth (서버 중심)

```
브라우저 ─POST connect(Bearer)→ 서버: state(1회용, 10분, 사용자 바인딩) 저장 + HttpOnly 바인딩 쿠키
        ←{ url: accounts.google.com … }
브라우저 → Google 동의 → GET /backend/service-integrations/google/callback?code&state
서버: state 해시 조회·삭제(1회용) → 만료·provider·바인딩 쿠키 검증 → code 교환 → scope 확인 → userinfo
     → state 의 user_id 행에만 암호화 저장 → 302 /service-integrations?google=connected
       (tasks.readonly 가 빠졌으면 ?google=connected&reason=tasks_scope_missing)
```

- scope: `openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly` (Drive·쓰기 없음). `include_granted_scopes=true`, `prompt=consent select_account`.
- 토큰 응답의 `scope` 를 credential 에 저장하고(`publicConfig.scopes` 에도 목록) 그것으로만 판단한다. 기존 refresh token 에 tasks.readonly 가 있다고 가정하지 않는다.
- Calendar 권한이 없으면 연결 실패(`scope_missing`). Tasks 권한만 없으면 연결은 유지하고 Tasks 만 `scope_missing`(`needsReconsent: true`) — 같은 연결 흐름으로 다시 연결하면 된다. Calendar 는 계속 동작.
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
| GET | `/service-integrations` | 기존 카드 목록. `google_calendar` 카드(이름 `Google`)는 아래 status 를 반영(`accountLabel`=email, `connectedAt`, `lastSyncedAt`=마지막 조회, `products`, `needsReconsent`) |
| GET | `/service-integrations/google/status` | 아래 GoogleStatus. 토큰 없음 |
| POST | `/service-integrations/google_calendar/connect` | `{ action: 'redirect', url }`. 미설정이면 409 `provider_unconfigured` |
| GET | `/service-integrations/google/callback` | Google 리디렉션 전용(Bearer 없음) |
| POST | `/service-integrations/google_calendar/disconnect` | 자기 연결 revoke + 삭제 |
| GET | `/service-integrations/google/calendars` | `{ calendars: GoogleCalendar[] }` |
| GET | `/service-integrations/google/events?start&end[&calendarIds=a,b]` | `{ start, end, calendars, events: ScheduleEvent[] }`. `calendarIds` 생략 시 기본 표시 캘린더 |
| GET | `/service-integrations/google/tasks?start&end` | `{ start, end, taskLists, tasks: ScheduleTask[] }`. tasks.readonly 없으면 409 `scope_missing` + `needsReconsent: true` |
| GET | `/schedule/events?from&to[&sources][&calendarIds]` | 일정 관리 통합(CRM + Google Calendar + Google Tasks + ONE FC 할 일) |

Google API 오류 code: `unconfigured`(409), `not_connected`(409), `needs_reauth`(409), `scope_missing`(409, Tasks), `google_forbidden`(502), `google_unavailable`(502). 기간 오류 `invalid_range` / `range_too_wide`(400, 최대 400일).

### GoogleStatus

```json
{ "provider": "google", "configured": true, "status": "connected",
  "accountEmail": "user@example.com", "displayName": "", "connectedAt": "…", "lastFetchedAt": "…",
  "calendarReadable": true, "tasksReadable": false, "needsReconsent": true,
  "products": {
    "calendar": { "status": "available", "scopeGranted": true, "readOnly": true },
    "tasks": { "status": "scope_missing", "scopeGranted": false, "needsReconsent": true, "readOnly": true }
  } }
```

`status`: `connected` \| `disconnected` \| `needs_reauth` \| `error`. 제품 `status`: `available` \| `scope_missing` \| `unconfigured` \| `disconnected` \| `needs_reauth` \| `error`.

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

## 4-1. ScheduleTask (할 일 공통 모델)

Google Tasks 와 ONE FC 할 일(기존 `todos`)을 같은 모양으로. 시간 축에 올리지 않는다.

| 필드 | 설명 |
|---|---|
| `id` | `google_task:{taskListId}:{taskId}` / `onefc_todo:{todo id}` |
| `source` | `google_task` \| `onefc_todo` |
| `sourceId` | Google task id / todo id |
| `taskListId`, `taskListName` | Google 만(ONE FC 는 `null`, `''`) |
| `title`, `notes` | 메모는 글자 그대로(최대 8000자) |
| `dueDate` | `YYYY-MM-DD` 또는 `null`(날짜 없음). Google `due`(예: `2026-10-03T00:00:00.000Z`)는 **문자열 앞 10자만** 쓴다. Date/시간대 변환 없음 → KST 에서 하루 밀리지 않는다 |
| `dueTime` | ONE FC 할 일에 시각이 있을 때만. Google 은 항상 `null`(시간을 지어내지 않음) |
| `status` | `open` \| `completed` (Google `needsAction`/`completed`, ONE FC `pending`/`completed`. 취소된 ONE FC 할 일은 제외) |
| `completedAt`, `parentId`, `updatedAt` | Google `completed` / `parent` / `updated` 그대로 |
| `customerId`, `customerName` | ONE FC 고객 연결 할 일만 |
| `readOnly` | 항상 `true`(일정 화면에서는 조회만. ONE FC 할 일 수정은 할 일 화면) |

Google Tasks 조회: `GET tasks/v1/users/@me/lists`(pagination) → 목록마다 `GET tasks/v1/lists/{id}/tasks?showCompleted=true&showHidden=true&maxResults=100`(pagination). 기본 목록을 가정하지 않는다. 삭제된 할 일은 뺀다.

ONE FC 할 일: `GET /api/todos` 와 같은 함수(`todoOwnerConditions` · `todoVisibilityCondition` · `selectVisibleTodos` · `mapTodoRow`)로 읽는다 — 같은 GA 안에서 내가 만들었거나 배정된 할 일, 고객 연결 할 일은 그 고객을 볼 수 있을 때만.

기간 선택(서버): 기간 안 예정일 + 예정일 없음 + 오늘(KST) 이전의 미완료(지난 할 일).

## 5. `/schedule/events`

`sources` 값(화면 칩): `google`(Google 일정) · `google_task`(Google 할 일) · `onefc_todo`(ONE FC 할 일) · `customer_alert`(알림일) · `car_expiry`(자동차 만기) · `insurance_age`(상령일). 생략·`all` 은 전부.

CRM 은 알림 달력·전체 알림과 같은 `loadReminderSourceRows` + `assembleReminderEvents` 를 그대로 쓴다(쿼리 복제 없음).

```json
{
  "from": "2026-09-27", "to": "2026-11-07",
  "today": "2026-10-02",
  "sources": ["google", "google_task", "onefc_todo", "customer_alert", "car_expiry", "insurance_age"],
  "google": {
    "configured": true, "connected": true, "status": "connected", "calendars": [],
    "tasks": { "status": "connected", "needsReconsent": false, "taskLists": [{ "id": "…", "name": "내 할 일 목록" }] }
  },
  "sourceStatus": { "google": "connected", "google_task": "connected", "onefc_todo": "ok", "crm": "ok" },
  "events": [],
  "tasks": []
}
```

`google.status`(Calendar): `unconfigured` \| `disconnected` \| `connected` \| `needs_reauth` \| `error` \| `skipped`. `google.tasks.status`: 위 + `scope_missing`. `sourceStatus.crm`·`onefc_todo`: `ok` \| `error` \| `skipped`.

출처는 따로 읽고 따로 실패한다. Calendar·Tasks·CRM·ONE FC 할 일 중 하나가 실패해도 200 으로 나머지를 돌려주고, 실패한 출처만 `sourceStatus` 에 표시한다.

## 6. 화면 계약 (웹 · 네이티브 공통)

- 메뉴 `일정 관리`(`/schedule`, `/schedule/week`, `/schedule/day`, `/schedule/list`). 설정은 `서비스 연동`.
- 기간 단위로만 조회(월간 그리드 42일, 주 7일, 일 1일). 월간·주간 모두 일요일 시작(주간 `from`=그 주 일요일, `to`=토요일). polling 없음. 출처 필터는 받은 데이터에서 거른다.
- 필터: 전체 · Google 일정 · Google 할 일 · ONE FC 할 일 · 알림일 · 자동차 만기 · 상령일, 그리고 `완료 포함`(기본은 열린 할 일만).
- 월간: 예정일 있는 할 일은 그 날 칸에 테두리형 `○`(완료 `✓`) 칩. 날짜 없음은 칸에 올리지 않는다.
- 주간: 할 일은 시간 축에 올리지 않고 종일 영역 아래 `할 일` 줄. 일간: 시간 일정과 따로 위쪽 `할 일` 묶음.
- 목록: `지난 할 일`(예정일 < 오늘 KST, 미완료) → 일정 → `할 일` → `날짜 없음`. 출처 badge. 순서·상태를 바꾸지 않는다.
- 할 일 상세: 읽기 전용(제목·목록·예정일·메모·상태·`Google 출처`). 편집 UI 없음. ONE FC 할 일은 `할 일 화면에서 보기`만.
- 미연동: `Google을 연결하면 Google Calendar 일정과 Google Tasks 할 일을 함께 볼 수 있습니다.` + `서비스 연동으로 이동`.
- Tasks 권한 없음: `Google 할 일을 보려면 Google을 다시 연결해 Google Tasks 읽기 권한을 허용해 주세요.` + `서비스 연동에서 다시 연결`. Tasks 실패: `Google 할 일을 불러오지 못했습니다.` 다른 출처는 그대로.
- 서비스 연동 Google 카드: 제목 `Google`, `연동됨` + email, `사용 중: Google Calendar · Google Tasks (읽기 전용)`. Tasks 권한이 없으면 Calendar 만 표시하고 다시 연결 안내.
- `needs_reauth`: Google 칩에 `재연결 필요`, 서비스 연동에서 `다시 연결`. CRM 일정은 그대로.
- 로그아웃 → 다른 계정 로그인 시 이전 사용자 Google 상태·일정·할 일을 표시하지 않는다(상태는 사용자 id 로 묶음).

## 7. 향후 확장 (지금 구현 안 함)

- 양방향: 같은 `ScheduleEvent`/`ScheduleTask` 의 `source/sourceId` 로 쓰기 어댑터를 붙이고, 그때 쓰기 scope 를 incremental auth 로 추가한다(지금은 요청하지 않음).
- Drive: 같은 `provider_key='google'` 행에 scope 만 추가. 토큰 저장소를 새로 만들지 않는다.
- Naver: USER scoped, `user_id + provider_key` 가 SSOT.
