# ONE FC — Google OAuth 검증 제출 자료 (초안)

> 공식 도메인이 정해지기 전까지 `<OFFICIAL_DOMAIN>` 은 자리표시자다. 실제 도메인으로 바꾼 뒤 제출한다.
> 비밀값(Client secret, 토큰, 비밀번호, 환경변수 값)은 이 문서와 제출 화면 어디에도 넣지 않는다.

## 1. 앱 정보

| 항목 | 값 |
|---|---|
| App name | ONE FC |
| GCP project | ONE FC (`fluted-legacy-510402-f3`) |
| User type / 상태 | External / Testing → In production 전환 시 검증 필요 |
| Application homepage | `https://<OFFICIAL_DOMAIN>/introduction` (권장, 아래 참고) |
| Privacy policy | `https://<OFFICIAL_DOMAIN>/privacy` |
| Terms of service | `https://<OFFICIAL_DOMAIN>/terms` |
| Authorized domain | `<OFFICIAL_DOMAIN>` |
| Redirect URI | `https://<OFFICIAL_DOMAIN>/backend/service-integrations/google/callback` |
| User support email | tjddyd55@gmail.com |
| Developer contact | tjddyd55@naver.com |

### 홈페이지 URL 메모
- `/` 는 비로그인 시 `/login?required=1` 로 이동한다. 로그인 화면에도 ONE FC 이름, 한 줄 설명, 이용약관·개인정보처리방침 링크, 사업자·연락처(BusinessInfoFooter)가 보인다.
- 다만 Google 검토는 "로그인 화면만 있는 홈페이지"를 반려하는 경우가 있어, 기능 소개와 Google Calendar 연동 문장이 있는 공개 랜딩 `/introduction` 을 홈페이지로 등록하는 것을 권장한다.
- 홈페이지, 개인정보처리방침, 약관, Redirect URI 는 모두 같은 `<OFFICIAL_DOMAIN>` 아래에 있어야 한다. `*.up.railway.app` 은 소유 도메인으로 인증할 수 없으므로 공식 도메인이 필요하다.

## 2. 요청 scope

| Scope | 구분 | 용도 |
|---|---|---|
| `openid` | 비민감 | 연결한 Google 계정 식별 |
| `https://www.googleapis.com/auth/userinfo.email` (`email`) | 비민감 | 연결된 계정 이메일을 서비스 연동 화면에 표시 |
| `https://www.googleapis.com/auth/userinfo.profile` (`profile`) | 비민감 | 연결된 계정 이름 표시 (프로필 사진은 저장하지 않음) |
| `https://www.googleapis.com/auth/calendar.readonly` | 민감(Sensitive) | 사용자 본인 캘린더 목록·일정을 일정 관리 화면에 읽기 전용으로 표시 |

- 쓰기 scope(`calendar`, `calendar.events`)와 Drive·Gmail scope 는 요청하지 않는다.
- `calendar.readonly` 는 Restricted scope 가 아니므로 CASA 보안 평가 대상은 아니다(민감 scope 검증: 데모 영상·scope 사유·도메인 인증 필요).

## 3. Scope justification (calendar.readonly)

### English
ONE FC is a work tool for insurance agents. When a user explicitly connects their Google account on the Service Integrations page, ONE FC uses the calendar.readonly scope to read that user's own calendar list and events and display them, read-only, in ONE FC's Schedule screen next to their ONE FC reminders. ONE FC never creates, modifies or deletes Google Calendar events. Data is requested only after the user connects, is shown only to that same user (not to other ONE FC users, including administrators), and is not stored permanently (server cache of about 60 seconds). The user can disconnect at any time, which deletes the stored credential and revokes the token.

### 한국어
ONE FC는 보험 설계사용 업무 도구입니다. 사용자가 서비스 연동 화면에서 직접 Google 계정을 연결하면, ONE FC는 calendar.readonly 권한으로 그 사용자 본인의 캘린더 목록과 일정을 읽어 ONE FC 일정 관리 화면에 ONE FC 알림 일정과 함께 읽기 전용으로 표시합니다. ONE FC는 Google Calendar 일정을 생성·수정·삭제하지 않습니다. 데이터는 사용자가 연결한 뒤에만 요청하고, 같은 사용자에게만 보이며(관리자를 포함한 다른 ONE FC 사용자에게 보이지 않음), 영구 저장하지 않습니다(서버 캐시 약 60초). 사용자는 언제든지 연결을 해제할 수 있고, 해제 시 저장된 인증 정보를 삭제하고 토큰을 폐기합니다.

## 4. 개인정보처리방침 대응 위치
- `/privacy` 제13조 `Google 서비스 연동`: 접근 정보, 목적, 권한 범위, 보관(암호화·브라우저 미저장·약 60초 캐시), 제공·공유(제3자·광고 미사용), 연결 해제(서비스 연동 화면 + https://myaccount.google.com/permissions), Limited Use 문장(한국어 + 영어, 정책 링크).
- `/terms` 제4조: 외부 서비스 연동은 선택·사용자 직접 연결·읽기 전용·언제든 해제, 개인정보처리방침 참조.
- `/introduction` 주요 기능 요약: Google Calendar 읽기 전용 연동 문장.

## 5. 제출 전 확인
- [ ] `<OFFICIAL_DOMAIN>` 확정, Search Console 소유 확인, OAuth 동의 화면 Authorized domain 등록
- [ ] 홈페이지·개인정보처리방침·약관 URL 이 로그인 없이 열리는지 확인
- [ ] OAuth client Redirect URI 에 공식 도메인 callback 추가, Railway `GOOGLE_OAUTH_REDIRECT_URI` 갱신
- [ ] 동의 화면 앱 로고·이름이 실제 서비스와 같은지 확인
- [ ] 데모 영상(`demo-video-script.md`) 촬영·YouTube(일부 공개) 업로드
