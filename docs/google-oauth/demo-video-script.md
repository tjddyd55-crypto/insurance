# ONE FC — Google OAuth 검증용 데모 영상 스크립트

촬영 원칙
- 비밀번호, Client secret, 토큰, 환경변수, 브라우저 개발자 도구를 화면에 띄우지 않는다. 로그인 입력은 미리 해 두거나 화면 밖에서 입력한다.
- Google 동의 화면은 영어로 보이도록 한다. 연결 시작 후 주소창의 Google URL 끝에 `&hl=en` 을 붙이거나, 브라우저 언어를 English 로 둔다.
- 주소창이 보이게 촬영해 `<OFFICIAL_DOMAIN>` 과 OAuth client 가 일치함을 보여 준다. 동의 화면에서 앱 이름 `ONE FC` 와 `calendar.readonly` 권한 문구가 보여야 한다.
- 테스트 Google 계정은 일정이 2~3건 있는 전용 계정을 쓴다.

| # | 화면 / 동작 | English narration / caption |
|---|---|---|
| 1 | ONE FC 로그인 화면에서 테스트 계정으로 로그인 | "This is ONE FC, a work tool for insurance agents. I sign in with a test account." |
| 2 | 메뉴에서 `서비스 연동` 열기 | "I open the Service Integrations page, where users manage external connections." |
| 3 | Google Calendar 카드가 `미연동` 상태 | "Google Calendar is not connected yet. Nothing is accessed until the user chooses to connect." |
| 4 | `Google 연결` 클릭 | "I click Connect Google. ONE FC redirects to Google's sign-in page." |
| 5 | Google 계정 선택 화면 | "I choose the Google account I want to connect." |
| 6 | 동의 화면: 앱 이름 ONE FC, `See and download any calendar you can access using your Google Calendar` (calendar.readonly) 표시 | "The consent screen shows ONE FC and the only sensitive permission requested: read-only access to Google Calendar." |
| 7 | `Continue`/`Allow` 클릭 후 ONE FC 로 복귀 | "After I allow access, Google returns me to ONE FC." |
| 8 | 카드가 `연동됨`, 계정 이메일·연결 시각 표시, `Google 계정이 연결되었습니다.` 안내 | "The card now shows Connected, with the connected Google account email and the time it was connected." |
| 9 | 메뉴에서 `일정 관리` 열기 | "I open the Schedule screen." |
| 10 | 월간 보기: Google 일정과 CRM(알림일·자동차 만기·상령일) 일정이 함께 표시 | "In the monthly view, my own Google Calendar events appear next to my ONE FC reminders." |
| 11 | 주간 보기(일요일 시작) | "The weekly view shows the same events by day and time." |
| 12 | 일간 보기 | "The daily view lists that day's events in time order." |
| 13 | Google 일정 하나 클릭 → 상세 창 | "Opening a Google event shows its details: time, calendar, location and description." |
| 14 | 상세 창의 `읽기 전용` 표시, 수정·삭제 버튼 없음, `Google Calendar에서 열기` 링크만 있음 | "Google events are read-only in ONE FC. There is no edit or delete; the only action is opening the event in Google Calendar." |
| 15 | `서비스 연동` → Google Calendar → `연결 해제` → 확인 | "I go back to Service Integrations and disconnect Google. ONE FC deletes the stored credential and revokes the token." |
| 16 | 카드가 `미연동` 으로 돌아옴 | "The card is back to Not connected." |
| 17 | `일정 관리` 재진입: Google 일정은 사라지고 CRM 일정은 그대로 | "In the Schedule screen, Google events are gone, while ONE FC's own reminders remain. Users can also remove access anytime at myaccount.google.com/permissions." |

마무리 자막(선택)
- "ONE FC requests calendar.readonly only, never modifies Google Calendar, shows data only to the connected user, and does not use it for ads."
