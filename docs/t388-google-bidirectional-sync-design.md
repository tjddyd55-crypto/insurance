# t388 Phase 2 — Google Calendar/Tasks ↔ ONE FC 양방향 동기화 설계안 (승인 전 구현 안 함)

## 현황(코드 확인)
- ONE FC 할 일 SSOT: `todos` 테이블(todosApi). Google 매핑 컬럼 없음.
- ONE FC 일반 일정 SSOT: **없음**. `calendar_items`(schedule/todo) 테이블은 initDb 에 스키마만 있고 사용하는 API 0개.
- Google → ONE FC: 읽기 전용 조회(모든 taskList·calendarList defaultVisible, 60초 사용자별 캐시, refresh=1 시 사용자 캐시 비움). 서버 로직 정상(테스트 통과).
- ONE FC → Google: `Google 일정`/`Google 할 일` 저장은 Google 에 직접 쓰기(로컬 사본 없음). CRM 알림은 `google_calendar_sync_map` 단방향 사본(autosync) — 양방향 대상에서 제외.

## 제안 모델
- 새 테이블(additive) `google_task_links`:
  user_id, ga_id, google_account_id, todo_id(FK todos), task_list_id, google_task_id,
  google_etag, google_updated_at, onefc_updated_at, content_hash, sync_status('ok'|'conflict'|'deleted_remote'|'deleted_local'), last_synced_at
  UNIQUE(user_id, google_account_id, task_list_id, google_task_id), UNIQUE(todo_id)
- 커서 테이블 `google_task_sync_cursor`(user_id, google_account_id, task_list_id, updated_min) — tasks.list updatedMin 증분.
- 일정은 SSOT 부재 → Phase 4 보류(아래 결정 필요).

## 정책안
- scope: 할 일 쓰기 = `auth/tasks`(기존 write 동의 재사용). 일정 = `calendar.events`.
- sync 대상 목록: 사용자가 설정에서 고른 taskList 1개(이름 하드코딩 금지, id 저장). 기본 = 없음(opt-in).
- 초기 import: 선택 목록의 미완료 + 최근 30일 완료만, 링크 생성. 기존 ONE FC 할 일은 자동 업로드 안 함(사용자 선택 시만).
- trigger: 일정/할 일 화면 진입·수동 새로고침 시 증분 pull(기존 60초 캐시·쿨다운 유지), ONE FC 쓰기 시 즉시 push. 백그라운드 무한 polling 없음.
- dedupe: 링크된 Google Task 는 ONE FC 할 일 1건으로만 표시(google_task 쪽 숨김). 키 = (account, list, taskId).
- loop 방지: push 후 받은 etag/updated 저장, pull 시 동일 etag·content_hash 면 무시.
- conflict: 양쪽 모두 마지막 sync 이후 변경 → 자동 덮어쓰기 금지, sync_status='conflict' + UI 에서 선택.
- delete: Google 삭제 → ONE FC 할 일 '취소' 처리 아님, 링크만 deleted_remote 표시 후 사용자 확인. ONE FC 삭제/취소 → Google 은 기본 유지(옵션: 완료 처리). 하드 삭제 전파는 하지 않음(제안).
- 사용자 격리: 모든 조회 user_id+google_account_id 조건. frontend 는 서버 API 만(Native 동일 API).
- 로그: `[google-sync] {userHash, source, action, itemId, result, code}` 토큰·고객정보 없음.

## 결정 필요(섹션 45 blocker)
1. ONE FC 일반 일정 SSOT: calendar_items 활성화할지 / 일정 양방향 범위 제외할지
2. sync 대상 taskList: 단일 선택 opt-in 안 승인?
3. 초기 import 범위(미완료 + 최근 30일 완료) 승인?
4. 삭제 정책(전파 안 함, 표시 후 확인) 승인?
5. migration: 위 2개 테이블 additive 생성 승인?
