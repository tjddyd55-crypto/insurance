# ONE FC — Google OAuth 검증용 데모 영상 스크립트 (Calendar + Tasks, 읽기 전용)

촬영 원칙
- 비밀번호, Client secret, 토큰, 환경변수, 브라우저 개발자 도구를 화면에 띄우지 않는다. 로그인 입력은 미리 해 두거나 화면 밖에서 입력한다.
- Google 동의 화면은 영어로 보이도록 한다. 연결 시작 후 주소창의 Google URL 끝에 `&hl=en` 을 붙이거나, 브라우저 언어를 English 로 둔다.
- 주소창이 보이게 촬영해 `onefc.platform-assets.com` 과 OAuth client 가 일치함을 보여 준다. 동의 화면에서 앱 이름 `ONE FC` 와 Calendar·Tasks 읽기 권한 문구가 보여야 한다.
- 테스트 Google 계정은 일정 2~3건, 할 일 2~3건(예정일 있는 것 1건 이상, 메모 있는 것 1건)이 있는 전용 계정을 쓴다.
- ONE FC 쪽에도 테스트 계정의 ONE FC 할 일·알림 일정이 1건 이상 있어야 15단계에서 "유지"를 보여 줄 수 있다.

| # | 화면 / 동작 | English narration / caption |
|---|---|---|
| 1 | 로그인한 상태에서 메뉴 `서비스 연동` 열기. Google 카드가 `미연동` | "This is ONE FC, a work tool for insurance agents. On the Service Integrations page, Google is not connected yet. Nothing is accessed until the user chooses to connect." |
| 2 | Google 카드의 `Google 연결` 클릭 → Google 계정 선택 | "I click Connect Google and choose the Google account I want to connect." |
| 3 | OAuth 동의 화면(영어, `hl=en`): 앱 이름 ONE FC 표시 | "Google's consent screen shows the app name, ONE FC." |
| 4 | 동의 화면의 권한 목록: Google Calendar 보기(calendar.readonly) + Google Tasks 보기(tasks.readonly). 쓰기 권한 없음 | "ONE FC requests only two sensitive permissions, both read-only: view Google Calendar and view Google Tasks. No permission to create, edit or delete." |
| 5 | `Continue`/`Allow` → ONE FC 로 복귀. 카드 `연동됨`, 계정 이메일, `사용 중: Google Calendar · Google Tasks (읽기 전용)` | "Google returns me to ONE FC. The Google card shows Connected, the account email, and that Google Calendar and Google Tasks are in use, read-only." |
| 6 | 메뉴 `일정 관리` → 월간 보기 | "I open the Schedule screen in the monthly view." |
| 7 | 월간 칸의 Google Calendar 일정(채워진 칩)과 ONE FC 알림 일정 | "My own Google Calendar events appear on their days, next to my ONE FC reminders." |
| 8 | 같은 월간 칸의 Google 할 일(○ 표시 테두리 칩). `Google 할 일` 필터 칩 눌러 할 일만 보기 | "My Google Tasks with a due date appear on their due day with a task badge. The Google Tasks filter shows them on their own." |
| 9 | 주간 보기(일요일 시작): 시간 축의 일정, 위쪽 `할 일` 줄의 할 일 | "In the weekly view, calendar events sit on the time grid, and tasks are shown in a separate To-do row, never on the time grid." |
| 10 | 일간 보기: 위쪽 `할 일` 묶음 + 아래 시간순 일정 | "The daily view lists that day's tasks first, separate from timed events." |
| 11 | 목록 보기: `지난 할 일`, 일정, `할 일`, `날짜 없음` 묶음과 출처 badge | "The list view groups overdue tasks, events, tasks for this month, and tasks without a due date, each with a source badge." |
| 12 | Google 할 일 하나 클릭 → 상세: 제목·목록·예정일·메모·상태·`Google 출처 · 읽기 전용`, 편집 버튼 없음 | "Opening a Google task shows its title, list, due date, notes and status. It is read-only: ONE FC never creates, edits, completes or deletes Google Tasks." |
| 13 | `서비스 연동` → Google 카드 `연결 해제` → 확인 | "I go back to Service Integrations and disconnect Google. ONE FC deletes the stored credential and revokes the token." |
| 14 | `일정 관리` 재진입: Google 일정과 Google 할 일이 모두 사라짐 | "In the Schedule screen, Google Calendar events and Google Tasks are gone." |
| 15 | ONE FC 자체 알림 일정·ONE FC 할 일은 그대로 표시 | "ONE FC's own reminders and to-dos remain. Users can also remove access anytime at myaccount.google.com/permissions." |

마무리 자막(선택)
- "ONE FC requests calendar.readonly and tasks.readonly only, never modifies Google Calendar or Google Tasks, shows data only to the connected user, and does not use it for ads."
