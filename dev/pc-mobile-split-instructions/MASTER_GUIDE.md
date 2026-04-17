# 🔥 PC / 모바일 완전 분리 (최종 안정 버전)

## 핵심 규칙
1. isMobile은 딱 한 곳에서만 사용
2. View에서는 isMobile 금지
3. Container = 상태 / View = UI
4. CSS는 pc-root / mobile-root 분리
5. 핵심 상태 수정 금지

## 분기 위치
CustomerWorkspaceLayout.tsx 에서만 분기

## 핵심 한 줄
👉 PC / 모바일은 완전히 다른 앱처럼 만든다
