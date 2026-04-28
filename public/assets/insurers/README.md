# 보험사 로고 (자체 호스팅)

- 초기 시드는 **로고 경로를 비웁니다.** UI는 보험사명 기반 placeholder를 씁니다.
- 실제 로고를 넣을 때:
  - **권장:** 수퍼관리자 **보험사 설계사이트 관리**에서 **로고 업로드** → `/uploads/system/insurers/insurer_{id}.(png|jpg|webp)`
  - 또는 이 디렉터리에 브랜드 가이드에 맞는 PNG/JPEG/WebP를 넣고, 관리 화면에서 `logo_path`에 `/assets/insurers/파일명.png` 를 입력
- 외부 이미지 URL을 `img src`에 직접 넣지 마세요. `/assets/...` 또는 `/uploads/...` 같은 **동일 출처 경로**만 사용합니다.
