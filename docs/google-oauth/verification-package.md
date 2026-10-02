# ONE FC — Google OAuth 검증 제출 자료 (초안)

> 공식 도메인: `onefc.platform-assets.com` (Railway prod app 커스텀 도메인. Railway 도메인 인증·SSL 정상, Search Console 에서 `platform-assets.com` Domain property 인증 완료 — 2026-10-02 사용자 확인).
> 비밀값(Client secret, 토큰, 비밀번호, 환경변수 값)은 이 문서와 제출 화면 어디에도 넣지 않는다.

## 1. 앱 정보

| 항목 | 값 |
|---|---|
| App name | ONE FC |
| GCP project | ONE FC (`fluted-legacy-510402-f3`) |
| User type / 상태 | External / Testing → In production 전환 시 검증 필요 |
| Application homepage | `https://onefc.platform-assets.com/` |
| Privacy policy | `https://onefc.platform-assets.com/privacy` |
| Terms of service | `https://onefc.platform-assets.com/terms` |
| Authorized domain | `platform-assets.com` |
| Redirect URI | `https://onefc.platform-assets.com/backend/service-integrations/google/callback` |
| User support email | tjddyd55@gmail.com |
| Developer contact | tjddyd55@naver.com |

### Domain ownership (for reviewers)

**English**
platform-assets.com is the official service domain owned and managed by the operator of ONE FC, 올인원솔루션 (All-in-One Solution; representative: 박성용 / Park Seongyong; Korean business registration number 232-51-00991). ONE FC is served at the `onefc` subdomain (`https://onefc.platform-assets.com`). Ownership of platform-assets.com is verified in Google Search Console as a Domain property.

**한국어**
platform-assets.com 은 ONE FC 운영자인 올인원솔루션(대표 박성용, 사업자등록번호 232-51-00991)이 소유·관리하는 공식 서비스 도메인입니다. ONE FC 는 `onefc` 서브도메인(`https://onefc.platform-assets.com`)에서 제공됩니다. platform-assets.com 의 소유권은 Google Search Console 에서 도메인 속성(Domain property)으로 인증되어 있습니다.

### 홈페이지 URL 메모
- `/` 는 비로그인 시 `/login?required=1` 로 이동한다. 로그인 화면에도 ONE FC 이름, 한 줄 설명, 이용약관·개인정보처리방침 링크, 사업자·연락처(BusinessInfoFooter)가 보인다.
- Google 검토에서 "로그인 화면만 있는 홈페이지"로 반려되면, 기능 소개와 Google Calendar·Google Tasks 연동 문장이 있는 공개 랜딩 `https://onefc.platform-assets.com/introduction` 으로 홈페이지 URL 을 바꿔 다시 제출한다.
- 홈페이지, 개인정보처리방침, 약관, Redirect URI 는 모두 `platform-assets.com` 아래에 있어야 한다. `*.up.railway.app` 은 소유 도메인으로 인증할 수 없다.

## 2. 요청 scope

| Scope | 구분 | 용도 |
|---|---|---|
| `openid` | 비민감 | 연결한 Google 계정 식별 |
| `https://www.googleapis.com/auth/userinfo.email` (`email`) | 비민감 | 연결된 계정 이메일을 서비스 연동 화면에 표시 |
| `https://www.googleapis.com/auth/userinfo.profile` (`profile`) | 비민감 | 연결된 계정 이름 표시 (프로필 사진은 저장하지 않음) |
| `https://www.googleapis.com/auth/calendar.readonly` | 민감(Sensitive) | 사용자 본인 캘린더 목록·일정을 일정 관리 화면에 읽기 전용으로 표시 |
| `https://www.googleapis.com/auth/tasks.readonly` | 민감(Sensitive) 예상 | 사용자 본인 Google Tasks 할 일 목록·할 일을 할 일/일정 관리 화면에 읽기 전용으로 표시 |

- 요청 scope 는 위 5개뿐이다(`openid email profile calendar.readonly tasks.readonly`). 쓰기 scope(`calendar`, `calendar.events`, `tasks`)와 Drive·Gmail scope 는 요청하지 않는다.
- `calendar.readonly`·`tasks.readonly` 는 Restricted scope 가 아니므로 CASA 보안 평가 대상은 아니다(민감 scope 검증: 데모 영상·scope 사유·도메인 인증 필요). 최종 분류는 Cloud Console 의 Data Access 화면에서 확인한다.
- 두 scope 모두 사용자가 서비스 연동 화면에서 직접 Google 을 연결한 뒤에만 요청·사용한다. Calendar 와 Tasks 는 같은 한 번의 연결(같은 사용자 credential)을 쓴다.

## 3. Scope justification

짧게, 사실만. Google 검토자는 영어를 읽으므로 EN 을 그대로 제출하고 KO 는 내부 확인용.

### calendar.readonly — English
ONE FC uses calendar.readonly to show the user's own Google Calendar events, read-only, in ONE FC's Schedule screen. It is requested only after the user explicitly connects Google on the Service Integrations page.

### calendar.readonly — 한국어
사용자의 Google Calendar 일정을 ONE FC 일정 관리 화면에 읽기 전용으로 표시합니다. 사용자가 서비스 연동 화면에서 직접 Google 을 연결한 뒤에만 요청합니다.

### tasks.readonly — English
ONE FC uses tasks.readonly to show the user's own Google Tasks, read-only, in the to-do and schedule views of ONE FC's Schedule screen. It is requested only after the user explicitly connects Google on the Service Integrations page. ONE FC never creates, edits, completes or deletes Google Tasks.

### tasks.readonly — 한국어
사용자의 Google Tasks 할 일을 ONE FC 할 일/일정 관리 화면에서 읽기 전용으로 표시합니다. 사용자가 서비스 연동 화면에서 직접 Google 을 연결한 뒤에만 요청합니다. ONE FC 는 Google Tasks 할 일을 생성·수정·완료 처리·삭제하지 않습니다.

### 공통 데이터 처리 설명 (필요 시 함께 제출)

**English**
ONE FC is a work tool for insurance agents. When a user explicitly connects their Google account on the Service Integrations page, ONE FC uses the calendar.readonly scope to read that user's own calendar list and events, and the tasks.readonly scope to read that user's own task lists and tasks, and displays them, read-only, in ONE FC's Schedule screen next to their ONE FC reminders and to-dos. ONE FC never creates, modifies or deletes Google Calendar events, and never creates, edits, completes or deletes Google Tasks. Data is requested only after the user connects, is shown only to that same user (not to other ONE FC users, including administrators), and is not stored permanently (server cache of about 60 seconds). The user can disconnect at any time, which deletes the stored credential and revokes the token.

**한국어**
ONE FC는 보험 설계사용 업무 도구입니다. 사용자가 서비스 연동 화면에서 직접 Google 계정을 연결하면, ONE FC는 calendar.readonly 권한으로 그 사용자 본인의 캘린더 목록과 일정을, tasks.readonly 권한으로 본인의 할 일 목록과 할 일을 읽어 ONE FC 일정 관리 화면에 ONE FC 알림 일정·할 일과 함께 읽기 전용으로 표시합니다. ONE FC는 Google Calendar 일정을 생성·수정·삭제하지 않고, Google Tasks 할 일을 생성·수정·완료 처리·삭제하지 않습니다. 데이터는 사용자가 연결한 뒤에만 요청하고, 같은 사용자에게만 보이며(관리자를 포함한 다른 ONE FC 사용자에게 보이지 않음), 영구 저장하지 않습니다(서버 캐시 약 60초). 사용자는 언제든지 연결을 해제할 수 있고, 해제 시 저장된 인증 정보를 삭제하고 토큰을 폐기합니다.

## 4. 개인정보처리방침 대응 위치
- `/privacy` 제13조 `Google 서비스 연동`: 접근 정보(Calendar 일정 + Tasks 할 일), 목적, 권한 범위(calendar.readonly + tasks.readonly 만), 보관(암호화·브라우저 미저장·약 60초 캐시), 제공·공유(ONE FC 계정별 연결·본인에게만 표시, 다른 ONE FC 이용자·제3자·광고 미사용), 연결 해제(서비스 연동 화면 + https://myaccount.google.com/permissions), Limited Use 문장(한국어 + 영어 "ONE FC's use and transfer of information received from Google APIs to any other app will adhere to Google API Services User Data Policy, including the Limited Use requirements.", 정책 링크).
- 개정 공지: 개인정보처리방침 제12조·약관 제12조의 "시행 7일 전 공지"에 맞춰 개정일(공지일) 2026-10-02, 시행일 2026-10-09. 두 페이지 머리말에 개정 안내 문단(종전 판 날짜·주요 변경). 운영 배포일이 늦어지면 공지일=배포일, 시행일=배포일+7일로 바꾼 뒤 배포한다.
- `/privacy` 제2조 수집 항목: Google Calendar 캘린더 목록 및 일정 정보, Google Tasks 할 일 목록 및 할 일 정보.
- `/terms` 제4조: Google Calendar 및 Google Tasks 연동은 선택·사용자 직접 연결·읽기 전용·언제든 해제, 개인정보처리방침 참조.
- `/introduction` 주요 기능 요약: Google Calendar 및 Google Tasks 읽기 전용 연동 문장.

## 5. 제출 전 확인
- [x] `onefc.platform-assets.com` DNS/SSL 적용 확인, Search Console 에서 `platform-assets.com` Domain property 소유 확인 (2026-10-02 사용자 확인)
- [ ] OAuth 동의 화면 Authorized domain 에 `platform-assets.com` 등록
- [ ] Google Tasks API 사용 설정, Data Access 에 `tasks.readonly` 추가(쓰기 `tasks` 는 추가하지 않음)
- [ ] 홈페이지·개인정보처리방침·약관 URL 이 로그인 없이 열리는지 확인
- [ ] OAuth client Redirect URI 에 `https://onefc.platform-assets.com/backend/service-integrations/google/callback` 추가, prod 에 Google 연동을 열 때 Railway prod `GOOGLE_OAUTH_REDIRECT_URI` 를 같은 값으로 설정
- [ ] 동의 화면 앱 로고·이름이 실제 서비스와 같은지 확인
- [ ] 데모 영상(`demo-video-script.md`) 촬영·YouTube(일부 공개) 업로드
