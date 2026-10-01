# 일정 이벤트 API

네이티브 앱과 웹은 같은 계약으로 일정을 읽는다. 화면은 출처를 따로 집계하지 않고, 서버가 정규화한 `ScheduleEvent` 배열만 그린다.

기준 시각은 `Asia/Seoul` 이다. 날짜 전용 값(`YYYY-MM-DD`)은 시간대를 더하지 않는다.

## 인증과 소유 범위

`GET /api/schedule/events` 는 로그인 세션이 필요하다.

| 조건 | HTTP | code |
|---|---|---|
| 세션 없음 | 401 | `unauthorized` |
| `gaId` 없음 | 400 | `ga_required` |

조회는 요청 사용자의 GA·사용자로만 제한한다.

- 고객 알림·자동차 만기·상령일: 기존 알림 집계와 같다. `customers.ga_id` 와 `COALESCE(owner_user_id, user_id)` 가 세션과 일치하고 `deleted_at IS NULL` 인 행만 쓴다.
- 개인 일정: `todos.ga_id` 와 `todos.owner_user_id` 가 세션과 일치하고 `status <> 'canceled'` 인 행만 쓴다.
- Google Calendar: `service_integrations` 의 `owner_scope = 'USER' AND user_id = 세션 AND ga_id IS NULL AND provider_key = 'google_calendar'` 행의 암호문만 복호화한다. 토큰은 응답·로그에 넣지 않는다.

## 요청

```
GET /api/schedule/events?from=2026-10-01&to=2026-10-31&sources=google,customer_alert
```

| 쿼리 | 타입 | 설명 |
|---|---|---|
| `from` | `YYYY-MM-DD` | 포함 시작일 |
| `to` | `YYYY-MM-DD` | 포함 종료일. `from` 보다 앞설 수 없다 |
| `sources` | 쉼표 구분 또는 `all` | 생략·빈 값·`all` 은 다섯 출처 전부 |

`sources` 값:

| 값 | 화면 칩 | 원천 |
|---|---|---|
| `google` | Google | Google Calendar `primary`, 읽기 전용 |
| `customer_alert` | 고객 알림 | `customer_special_dates` 매년 반복 |
| `car_expiry` | 자동차 만기 | `customer_cars.renewal_date`, 없으면 `customers.renewal_date` |
| `insurance_age` | 상령일 | `customers.next_age_date` |
| `personal` | 개인 일정 | `todos.due_date` / `due_time` |

기간이 400일을 넘으면 `400 range_too_wide`. 날짜 형식이 아니거나 시작이 끝보다 늦으면 `400 invalid_range`. 알 수 없는 출처면 `400 invalid_source`.

중복 `sources` 토큰은 한 번만 남긴다.

## 성공 응답

```json
{
  "success": true,
  "data": {
    "from": "2026-10-01",
    "to": "2026-10-31",
    "sources": ["google", "customer_alert", "car_expiry", "insurance_age", "personal"],
    "google": {
      "configured": false,
      "connected": false,
      "status": "unconfigured"
    },
    "events": [
      {
        "id": "special_date:4:2026-10-20",
        "source": "customer_alert",
        "sourceId": "4",
        "type": "special_date",
        "title": "이몽룡 · 건강검진",
        "startAt": "2026-10-20",
        "endAt": "2026-10-20",
        "allDay": true,
        "customerId": 2,
        "customerName": "이몽룡",
        "description": "건강검진 · 오전",
        "status": "confirmed",
        "phone": "01099998888",
        "htmlLink": null,
        "etag": null,
        "sourceDate": "1990-10-20",
        "sourceTitle": "건강검진"
      }
    ]
  }
}
```

### ScheduleEvent

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | 병합 후 유일한 키. 같은 `id` 는 먼저 들어온 한 건만 남긴다 |
| `source` | 위 다섯 값 | 칩·클릭 분기 |
| `sourceId` | string | 원본 행 id. 상령일은 고객 id, 자동차는 차량 id 또는 고객 폴백, Google 은 Calendar event id |
| `type` | string | `special_date` · `car_expiry` · `insurance_age_date` · `google_event` · `personal` |
| `title` | string | 화면 제목. 고객 알림은 `고객명 · 저장 제목` |
| `startAt` | string | 종일은 `YYYY-MM-DD`. 시간은 ISO-8601 (`2026-10-15T09:30:00+09:00` 또는 Google 의 UTC `dateTime`) |
| `endAt` | string | 종일 Google 종료일은 **exclusive**. CRM 종일은 시작일과 같다. 개인 일정은 시작 시각 + 1시간 |
| `allDay` | boolean | 날짜만 있으면 `true` |
| `customerId` | number \| null | Google·개인 일정은 null |
| `customerName` | string | |
| `description` | string | 메모·본문 |
| `status` | string | Google `confirmed` 등, 개인 일정 `pending`/`completed`. `cancelled` Google 이벤트와 `canceled` 할 일은 응답에 없다 |
| `phone` | string | CRM 출처만 |
| `htmlLink` | string \| null | Google 상세. 웹은 이 주소로 연다 |
| `etag` | string \| null | 이후 Google 쓰기·양방향 동기화용. 1단계는 저장만 한다 |
| `sourceDate` | string \| null | 고객 알림의 저장 `date_value`. 수정 시 이 연도를 보내야 하며, 화면 발생 연도를 보내면 안 된다 |
| `sourceTitle` | string \| null | 고객 알림의 저장 제목. 수정 폼은 `title` 이 아니라 이 값을 쓴다 |

정렬은 `startAt`, 같으면 `title` 한국어 순이다. 구간과 겹치지 않는 이벤트는 빠진다. 종일 종료일이 exclusive 이면 마지막 포함일은 종료일 전날이다. 시간이 있는 일정은 `Asia/Seoul` 날짜로 겹침을 판정한다. 예: `2026-10-15T15:30:00Z` 는 서울 2026-10-16 00:30 이다.

### google 상태

| status | 의미 |
|---|---|
| `unconfigured` | `GOOGLE_OAUTH_CLIENT_ID` 없음. 어댑터는 두고 연결은 하지 않는다 |
| `disconnected` | 클라이언트는 있으나 이 사용자 연결 행이 없거나 토큰이 비어 있다 |
| `connected` | 읽기에 성공 |
| `error` | 복호화 또는 Calendar API 실패. `events` 의 Google 건만 비우고 나머지 출처는 그대로 반환한다. 전체 500 으로 올리지 않는다 |
| `skipped` | 이번 요청 `sources` 에 `google` 이 없다 |

웹은 칩이 꺼져 있어도 연결 안내를 위해 `google` 을 조회에 포함하고, 화면 목록만 선택한 칩으로 거른다.

## 오류 본문

```json
{ "success": false, "code": "invalid_range", "message": "조회 기간은 YYYY-MM-DD 이고 시작이 끝보다 늦지 않아야 합니다." }
```

| code | message |
|---|---|
| `unauthorized` | 로그인이 필요합니다. |
| `ga_required` | GA 컨텍스트가 없습니다. |
| `invalid_range` | 조회 기간은 YYYY-MM-DD 이고 시작이 끝보다 늦지 않아야 합니다. |
| `range_too_wide` | 조회 기간이 너무 깁니다. |
| `invalid_source` | 알 수 없는 일정 출처입니다. |

그 외 DB 오류는 기존 `handleDbError` 형식이다.

## 화면이 쓰는 구간

서버 `seoulCalendarDate.js` 와 웹 `scheduleRange.ts` 가 같은 달력일을 만든다.

| 보기 | 경로 | 조회 구간 |
|---|---|---|
| 월간 | `/schedule?date=` | 일요일 시작 6주. 2026-10 은 `2026-09-27`–`2026-11-07` |
| 주간 | `/schedule/week?date=` | 월요일–일요일. 2026-10-15 는 `2026-10-12`–`2026-10-18` |
| 일간 | `/schedule/day?date=` | 그 날짜 하루 |
| 목록 | `/schedule/list?date=` | 해당 월 1일–말일 (패딩 없는 달) |

날짜를 누르면 `/schedule/day?date=` 로 간다. `sources` 쿼리는 선택한 칩만 담는다. 전체이면 쿼리를 비운다.

## 클릭

| source | 동작 |
|---|---|
| `google` | `htmlLink` 를 연다 |
| `customer_alert` | 수정 대화상자. 저장은 `PATCH /api/customers/:customerId/special-dates/:sourceId` 에 `{ title: sourceTitle, dateValue: sourceDate }` |
| `car_expiry` | `/customers/:customerId/auto-form` |
| `insurance_age` | 기존 고객 상세 진입 |
| `personal` | 이 화면에서는 추가 이동 없음 |

수정·확인 대화상자는 바깥 클릭과 Esc 로 바로 닫지 않는다. 값이 바뀐 뒤 닫으면 `변경사항이 저장되지 않았습니다. 닫으시겠습니까?` 를 확인한다.

## Google 1단계

서버만 Google Calendar REST 를 호출한다.

`GET https://www.googleapis.com/calendar/v3/calendars/primary/events`

- `singleEvents=true`
- `orderBy=startTime`
- `timeMin` / `timeMax` 는 조회 구간의 서울 자정. `timeMax` 는 종료일 다음날 00:00
- `maxResults=250`

OAuth 토큰은 `service_integrations.credential_ciphertext` 에만 있다. 평문은 액세스 토큰 문자열 또는 `{ "accessToken" | "access_token" }` JSON 이다. 브라우저 `localStorage` 와 로그에 두지 않는다. 클라이언트 ID 가 없으면 `google.status = unconfigured` 이고, 웹은 `Google Calendar를 연결하면 Google 일정도 함께 볼 수 있습니다.` 와 서비스 연동 버튼을 보여 준다.

쓰기와 양방향 동기화는 이 단계에 없다. `source`, `sourceId`, `etag` 를 이벤트에 남겨 이후 같은 모델로 붙인다. 일정 전용 테이블은 만들지 않는다.

## 넣지 않은 원천

`customer_consultations.next_contact_date` 는 상담 다음 연락일이라 일정 칩 계약에 없고, 고객 알림과 의미가 겹친다. 집계하지 않는다.

`todos` 달력(`/todos`)은 그대로 두고, 일정 관리의 개인 일정 칩만 그 행을 읽는다.

## DB

새 테이블·컬럼은 없다. `todos`, `customer_special_dates`, `customer_cars`, `customers.next_age_date`, `service_integrations` 를 읽기만 한다.
