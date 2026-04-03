# 동의서 PDF 한글 폰트

`consentPdfFill`은 한글 이름 등을 넣으려면 **임베드 폰트**가 필요합니다.

1. [Noto Sans KR](https://fonts.google.com/noto/specimen/Noto+Sans+KR) OTF 또는 TTF를 받아 이 폴더에 두거나
2. 환경 변수 `CONSENT_FONT_PATH`에 파일 절대 경로를 지정하세요.

기본 탐색 경로:

- `server/fonts/NotoSansKR-Regular.otf`
- `server/fonts/NotoSansKR-Regular.ttf`

폰트가 없으면 ASCII만 헬베티카로 그릴 수 있으며, 한글이 포함되면 API가 안내 메시지와 함께 400을 반환합니다.
