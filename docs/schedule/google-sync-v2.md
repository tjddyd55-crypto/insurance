# ONE FC 일정·할 일 입력 경로 통일 + Google Calendar/Tasks 양방향 동기화 (google-sync-v2)

상태: `ONEFC_GOOGLE_SYNC_INPUT_PATH_DESIGN_COMPLETE` (Phase 1 — 설계·기준선만, 운영 코드 변경 없음)
기준 커밋: insurance `develop` be769250, insurance-mobile `qa/widget-contacts-dev` 45a6f19

> 절대 원칙: 일정 화면의 **표시·집계·배지·정렬·UI 정책은 바꾸지 않는다.** 바꾸는 것은 입력 저장 경로와 동기화 구조뿐이다.
> 기준선: `server/schedule/scheduleBaseline.regression.test.js` + `src/features/schedule/domain/scheduleBaseline.regression.test.ts` (fixture `server/schedule/__fixtures__/scheduleBaseline.json`). 이후 모든 Phase 는 이 테스트를 그대로 통과해야 한다.

## 1. 현재 구조 (코드 기준)

### 1.1 일정 표시
| 영역 | 위치 |
|---|---|
| 서버 집계 SSOT | `GET /api/schedule/events` → `server/apis/registerScheduleApi.js` → `server/schedule/scheduleQuery.js#loadScheduleEvents` |
| 일정 정규화·병합·범위 | `server/schedule/scheduleEvents.js` (`normalizeReminderScheduleEvent`, `normalizeGoogleCalendarEvent`, `mergeScheduleEvents` id 중복 제거, `filterScheduleBySources`, `eventOverlapsRange`) |
| 할 일 정규화·선택·정렬 | `server/schedule/scheduleTasks.js` (`normalizeGoogleTask`, `normalizeOnefcTodo`, `selectScheduleTasks`, `sortScheduleTasks`) |
| 알림·만기·상령일 | `server/reminders/reminderQuery.js#loadReminderSourceRows` + `reminderEvents.js#assembleReminderEvents` |
| Google 읽기 | `server/integrations/googleCalendarAdapter.js#loadGoogleCalendarSchedule / loadGoogleTasksSchedule` (60s 캐시 `googleUserCache.js`, 수동 새로고침 `refresh=1` 10초 제한) |
| 웹 배지 | `src/features/schedule/domain/scheduleDayCount.ts#countScheduleItemsByDate` (+ `__fixtures__/scheduleDayCountCases.json`) |
| 웹 할 일 칸 | `src/features/schedule/domain/scheduleTasks.ts` (`tasksOnDate`, `filterScheduleTasks`, `groupListTasks`, `groupMonthTasks`) |
| 네이티브 | `insurance-mobile src/features/schedule/{ScheduleScreen.tsx, scheduleModel.ts, scheduleApi.ts}`, 배지 fixture 동일 파일 |
| 위젯 스냅샷 | `insurance-mobile src/features/home-widgets/adapters/scheduleWidgetAdapter.ts`, `ScheduleWidgetRenderer.kt`, `__tests__/scheduleWidgetCounts.test.ts` |

### 1.2 표시 출처 A–E
- **A. 일반 일정**: Google Calendar 이벤트(live read, `source='google'`). ONE FC 자체 일정은 **없음**. `extendedProperties.private.app='onefcAutoSync'` 사본은 숨김.
- **B. 알림 일정**: `customer_special_dates` → `type='customer_alert'` (매년 반복 날짜).
- **C. 기한/만료 일정**: `customer_cars.renewal_date`(없으면 `customers.renewal_date`) → `car_expiry`; `customers.next_age_date` → `insurance_age`(상령일).
- **D. 할 일**: ONE FC `todos`(`listTodosForSchedule`: 취소 제외, 날짜 없음 + 기간 내 + 지난 미완료) + Google Tasks(live read). 서버는 완료·날짜없음도 `tasks` 로 내려준다.
- **E. 배지·달력 칸 규칙(클라이언트)**: 일정은 걸친 날마다 1, 할 일은 `dueDate` 있고 미완료만 1. 완료·날짜없음은 배지 제외. 정렬: 이벤트 startAt→제목, 할 일 dueDate→열린 것 먼저→제목.

### 1.3 입력
| 입력 | 현재 저장 위치 |
|---|---|
| 웹 일정 | `ScheduleGoogleWrite.tsx` 저장 위치 선택(Google 일정/Google 할 일/ONE FC 할 일) → 일정은 `POST /service-integrations/google/write/events` → `googleWriteService.js#createGoogleCalendarEvent` (Google 직접 쓰기, ONE FC 저장 없음) |
| 웹 할 일 | `ScheduleTodoEditor.tsx` / 할 일 화면 → `POST /api/todos` (`todosApi.js`) 또는 Google 할 일 선택 시 `POST .../write/tasks` → `createGoogleTask` |
| 네이티브 | `scheduleModel.ts` `SCHEDULE_STORAGE_LABEL` / `storageAvailability` 로 같은 3택 |
| 위젯 빠른 추가 | `insurance-mobile src/features/home-widgets/widgetQuickAdd.ts` → `POST /service-integrations/google/write/events` (QA 브랜치만) |
| `calendar_items` | `server/initDb.js` ~4509 테이블·인덱스만 존재, 읽기/쓰기 코드 없음(AI 카탈로그 메타데이터만 참조) |

### 1.4 Google
- 연결: `service_integrations` 1행(`owner_scope='USER'`, `provider_key='google'`, unique `(user_id, provider_key) WHERE owner_scope='USER'`), 토큰은 `credential_ciphertext` 암호화(`integrationStore.js`). GA 공용·fallback 없음.
- 스코프: 기본 `openid email profile calendar.readonly tasks.readonly`; 쓰기 `calendar.events`, `tasks`(`purpose=write` 재동의, `POST /service-integrations/google/write/connect`).
- 쓰기 게이트: `GOOGLE_WRITE_ENABLED=true` + `GOOGLE_WRITE_ALLOWED_USER_IDS`(`isGoogleWriteEnabledFor`) + 저장된 scope(`assertGoogleWriteReady`).
- 상태: `readGoogleIntegrationStatus` → connected / disconnected / needs_reauth / error, 제품별 scope_missing.
- 자동 연동(t321): `googleCalendarAutoSync.js`, env `GOOGLE_CALENDAR_AUTOSYNC_ENABLED`, 기본 OFF. 할 일·알림을 `[할 일] 제목` 형식 사본으로 Google Calendar 에 단방향 생성, `google_calendar_sync_map` 으로 매핑, 90일 창, `onefcAutoSync` 태그.

## 2. 목표 데이터 원칙
ONE FC DB = 기준 저장소, Google = 동기화 대상. 사용자는 저장 위치를 고르지 않는다.
- 일정 → `calendar_items(item_type='schedule')` ↔ Google Calendar(기본 캘린더)
- 할 일 → 기존 `todos` ↔ Google Tasks(기본 목록 `@default`)
- Google 실패는 로컬 저장을 롤백하지 않는다(outbox 재시도).

## 3. 로컬 일정 저장소
`calendar_items` 재사용 + 보강(Dev migration 먼저, 운영은 승인 후):
- `owner_user_id TEXT NOT NULL`(= 기존 owner_type='user', owner_id), `ga_id` 는 감사·가시성용으로 유지. **USER scope**: 조회·동기화 키는 항상 `owner_user_id`, GA fallback 없음.
- 추가 컬럼: `start_date DATE`/`end_date DATE`(종일, end exclusive), `timezone TEXT DEFAULT 'Asia/Seoul'`, `recurrence JSONB NULL`, `customer_id BIGINT NULL`, `origin TEXT CHECK (origin IN ('onefc','google_import'))`, `version INT`, `request_id TEXT UNIQUE(owner_user_id, request_id)`(멱등).
- 할 일은 `calendar_items(item_type='todo')` 를 쓰지 않는다 → 기존 `todos` 재사용(중복 저장소 금지).

### API (기존 명명 규칙: `/api/<복수명사>`, `{ success, data }`)
- `GET /api/calendar-items?from&to` · `POST /api/calendar-items` (`requestId` 멱등) · `PATCH /api/calendar-items/:id` · `DELETE /api/calendar-items/:id`(soft delete)
- 할 일: 기존 `/api/todos` 그대로(POST/PATCH/complete/reopen/DELETE).

## 4. 외부 매핑 테이블
`external_sync_links`
| 컬럼 | 설명 |
|---|---|
| owner_user_id, provider ('google_calendar'\|'google_tasks') | USER scope |
| google_account_id | 계정 바뀌면 매핑 무효 |
| local_type ('calendar_item'\|'todo'), local_id | |
| remote_container_id (calendarId / taskListId), remote_id, remote_etag, remote_updated_at | |
| local_version_synced, content_hash, status (active\|pending_delete\|deleted\|conflict\|failed), last_error | |
UNIQUE `(owner_user_id, provider, local_type, local_id)` 와 `(owner_user_id, provider, google_account_id, remote_container_id, remote_id)`.
기존 `google_calendar_sync_map`(t321)은 Phase 7 에서 이 표로 흡수.

## 5. 필드 매핑
**Calendar ↔ calendar_items**: summary↔title, description↔description(plain), location↔location, start.date/end.date↔start_date/end_date(종일, end exclusive), start.dateTime/end.dateTime(+timeZone)↔start_at/end_at/timezone, status=cancelled↔deleted_at, recurrence↔recurrence(기존 Google 반복 처리 재사용, 인스턴스 개별 수정은 Phase 8 범위 밖 → 읽기 전용 표시), `extendedProperties.private.onefcId=<local id>`·`onefcApp='onefcSyncV2'`.
**Tasks ↔ todos**: title↔title, notes↔description, due(날짜만, `YYYY-MM-DDT00:00:00.000Z`)↔due_date, `due_time` 은 Google 로 보내지 않고 로컬 유지(Tasks API 시간 미지원), status completed/needsAction↔completed/pending, completed↔completed_at, deleted↔soft delete. `canceled` todo 는 Google 삭제.
날짜 문자열은 Date 변환 없이 앞 10자만(KST 하루 밀림 방지, 기존 `googleTaskDueDate` 규칙).

## 6. 쓰기 경로: transactional outbox
로컬 INSERT/UPDATE/DELETE 와 같은 트랜잭션에서 `sync_outbox(owner_user_id, provider, local_type, local_id, op, local_version, attempts, next_attempt_at, last_error_class)` 1행 추가(같은 항목은 최신 버전만 유효, coalesce).
워커(서버 인프로세스 tick, advisory lock 으로 사용자당 1개):
- **재시도**: 429, 5xx, 네트워크/타임아웃 → 지수 백오프(30s→… 최대 6h, 10회 후 failed 표시, 수동 재시도).
- **영구(사용자 조치 필요)**: `invalid_grant`/revoked → 연결 상태 needs_reauth, outbox 보류(삭제 안 함); `scope_missing`(쓰기 scope 없음) → 보류 `sync_pending`; 403 forbidden 캘린더/404 원격 없음 → 매핑 정리 후 재생성 여부 규칙에 따름.
- Google 이벤트 id 는 결정적(`eventIdFromRequestId` 방식 재사용) → 재시도 중복 생성 없음.

## 7. 읽기 경로: 증분 pull
- Calendar: `events.list(syncToken)`; 최초는 import 창으로 full list 후 nextSyncToken 저장. **410 Gone → 토큰 폐기, 창 범위 full resync**(매핑으로 중복 없이 upsert).
- Tasks: `tasks.list(updatedMin=last_pulled_at - 5분, showDeleted, showHidden, showCompleted)`.
- 상태 저장: `external_sync_cursors(owner_user_id, provider, google_account_id, container_id, sync_token, updated_min, last_pulled_at)`.
- 트리거: 일정 화면 열기/새로고침(기존 10초 제한 재사용), 로컬 쓰기 직후 push 후 pull, 주기 tick(연결 사용자 15분), 최초 연결/재연결. (Calendar push 알림 채널은 후속 선택 사항.)

## 8. 루프 방지·충돌
- push 결과의 remote etag/updated 를 매핑에 기록 → 다음 pull 에서 `remote_updated_at <= 매핑값` 이면 자기 변경으로 무시.
- pull 로 로컬 갱신 시 outbox 를 만들지 않는다(`origin=pull` 플래그 트랜잭션).
- 충돌 LWW: Google `updated` vs 로컬 `updated_at`. 같으면 로컬 우선. 진 쪽 내용은 `history` JSONB 에 남김.
- 삭제 충돌: 한쪽 삭제 + 다른 쪽이 삭제 시각 이후 수정 → 수정 쪽 우선(부활); 아니면 삭제 전파.

## 9. 연결 수명주기
- **최초 연결 import 창**: 과거 12개월 + 미래 24개월(일정), Tasks 는 미완료 전부 + 최근 12개월 완료.
- **재연결**: 같은 `google_account_id` 면 매핑·커서 재사용(중복 0); 다른 계정이면 이전 매핑 `status=detached`, 로컬 데이터 유지, 새 계정 기준 import.
- **연결 해제**: 로컬 데이터 유지(구글에서 가져온 항목 포함 — 열린 결정 #1), outbox 중단, 커서 삭제, 토큰 revoke.
- **scope 없음 UX**: 로컬 저장 PASS, 항목에 "동기화 대기" 표시만, 쓰기 권한 연결 안내. 저장 막지 않음.

## 10. 표시 전환과 중복 0 보장
- 플래그 `ONEFC_GOOGLE_SYNC_V2`(Dev 전용, 운영 기본 OFF).
- OFF: 현재 경로 그대로(기준선 동일).
- ON: `loadScheduleEvents` 의 A(Google live)·D(Google Tasks live) 출처를 **로컬 테이블 읽기로 교체**한다. 로컬 일정은 기존 필터 키 'google' 칸과 같은 표시 규칙으로 나간다(열린 결정 #3). Google 원본은 live read 하지 않으므로 local+mirror 2건이 생길 수 없다. 매핑된 Google 항목은 로컬 1건으로만 존재.
- 전환 검증: 같은 fixture 데이터를 로컬 테이블에 넣고 기준선 테스트 결과(배지·순서·출처 개수) 동일해야 함.
- 기존 `[할 일]` Calendar 사본(t321): v2 ON 사용자는 autosync todo kind 비활성 → 기존 `onefcAutoSync` 사본은 소유 태그 확인 후 미래분만 삭제(과거 보존, 기존 OFF 규칙 재사용). 알림 사본(car_expiry 등)은 별도 결정 전까지 기존 동작 유지(열린 결정 #2). 사본은 이미 표시에서 숨겨지므로 표시 변화 없음.
- 반복 일정: 기존 Google `singleEvents` 전개 처리 재사용, 로컬은 마스터+전개 결과 캐시.
- 시간대: 저장 UTC, 표시 KST, 종일은 date 문자열.

## 11. Phase 계획 (서버 먼저, 위젯/연락처 작업과 별도 브랜치·PR)
| Phase | 내용 | 레포/브랜치 |
|---|---|---|
| 2 | calendar_items 보강 migration(Dev), `/api/calendar-items` CRUD, 테스트 | insurance `feat/schedule-sync-v2-local-store` |
| 3 | 플래그 ON 시 표시 소스 로컬 전환(기준선 SAME 증명) | insurance |
| 4 | outbox + push(Calendar/Tasks), 재시도 분류 | insurance |
| 5 | 증분 pull, 루프 방지, LWW, 삭제 충돌, import 창, 재연결 | insurance |
| 6 | 웹 저장 위치 선택 제거 → 항상 ONE FC (서버 준비 후) | insurance |
| 7 | 네이티브 선택 제거 + 위젯 빠른 추가를 `/api/calendar-items` 로 | insurance-mobile 별도 브랜치(QA 통합은 나중) |
| 8 | t321 `[할 일]` 사본 은퇴, Dev E2E 양방향, 운영 승인 패키지 (`ONEFC_GOOGLE_SYNC_PROD_APPROVAL_READY`) — 운영 쓰기는 Google 심사 통과 후 | 둘 다 |

## 12. 열린 결정
1. 연결 해제 시 Google 에서 가져온 항목을 로컬에 남길지(제안: 남김).
2. t321 알림(만기·상령일·알림일) Calendar 사본을 v2 에서도 유지할지.
3. 로컬 일정의 필터 키: 기존 'google' 칸 유지(표시 동일) vs 새 'onefc_event'(UI 변경 필요 → 표시 정책 변경이므로 비추천).
4. 기본 캘린더/목록 외 다른 Google 캘린더도 pull 할지(제안: 현재 표시 선택 calendarIds 와 동일).
5. 위젯 빠른 추가 기본값: 종일 일정(현재) 유지.
