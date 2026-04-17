# R2 STORAGE BASE PATH RULE

모든 파일 업로드는 아래 경로를 기준으로 시작해야 한다.

platform-assets/insurer/{gaCode}/

---

## 규칙

1. 모든 R2 업로드는 반드시 위 경로를 prefix로 사용한다.
2. {gaCode}는 필수 값이며, 없는 경우 업로드를 허용하지 않는다.
3. 이 경로 이전에 다른 prefix를 추가하는 것을 금지한다.

---

## 예시

- platform-assets/insurer/yjasset/...
- platform-assets/insurer/abcga/...

---

## 금지

- platform-assets/user/...
- platform-assets/temp/...
- platform-assets/insurer/ (gaCode 없이 사용 금지)