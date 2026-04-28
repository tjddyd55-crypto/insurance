# 보험사 로고 (초기 번들)

- 이 디렉터리의 PNG는 **레이아웃·경로 검증용**이며, 현재는 1×1 투명 placeholder가 스크립트로 생성됩니다.
- **운영 반영 전** 브랜드 가이드에 맞는 실제 로고로 교체하거나, 수퍼관리자 화면의 **로고 업로드**로 `uploads/system/insurers/` 경로를 쓰도록 바꾸는 것을 권장합니다.
- 외부 이미지 URL을 `img src`에 직접 넣지 마세요. 반드시 `/assets/insurers/...` 또는 `/uploads/system/insurers/...` 같은 **자체 호스팅 경로**만 사용합니다.

생성: `node scripts/generate-insurer-placeholder-logos.mjs`
