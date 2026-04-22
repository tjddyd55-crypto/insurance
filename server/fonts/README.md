# 서버 PDF 한글 폰트

이 폴더에 배치된 한글 폰트는 다음 두 기능이 **공유**해서 사용한다:

1. `server/lib/consentPdfFill.js` — 보험사 동의서 PDF 자동 채움
2. `server/pdf-engine/renderer/fontProvider.js` — 좌표 기반 PDF 자동화 엔진

두 기능 모두 한글 텍스트를 원본 PDF 위에 스탬핑한다. `pdf-lib` 의 기본 Helvetica 는 한글 글리프가
없으므로, 한글을 쓰려면 **임베드 폰트 파일**이 반드시 필요하다.

## 배치 방법

다음 중 하나를 선택한다.

### (권장) 프로젝트 번들

[Noto Sans KR](https://fonts.google.com/noto/specimen/Noto+Sans+KR) 의 Regular 를 OTF 또는 TTF 로 받아 이 폴더에 둔다.

- `server/fonts/NotoSansKR-Regular.otf`  ← 우선 순위 1
- `server/fonts/NotoSansKR-Regular.ttf`  ← 우선 순위 2

### 환경변수 지정

배포 환경에서 별도 경로에 폰트를 두는 경우 `CONSENT_FONT_PATH` 에 **절대 경로**를 지정한다.
이 환경변수는 동의서·PDF 엔진이 공용으로 사용한다.

## 누락 시 동작

- 동의서: 한글이 포함된 요청은 400 을 반환한다.
- PDF 엔진: 500 을 반환하며 로그에 "한글 폰트 파일을 찾을 수 없습니다" 를 남긴다.
  (조용히 Helvetica 로 떨어지면 한글이 깨져 출력되므로, 명시적 실패가 안전하다.)
