# 🎯 목표
main 브랜치 push 시 자동 배포

# .github/workflows/deploy.yml

name: Deploy

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: 코드 가져오기
        uses: actions/checkout@v3

      - name: Node 설치
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: 의존성 설치
        run: npm install

      - name: Electron 빌드
        run: npm run build

      - name: Expo OTA 업데이트
        run: npx eas update --branch main --message "auto update"

# 결과
- main push → 자동 업데이트 배포