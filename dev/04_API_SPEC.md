# 4. API 설계서

## 4-1. 공통 원칙
- 고객 앱 API와 설계사 앱 API를 구분한다.
- 권한 검증을 반드시 넣는다.
- 링크 기반 연결 이후 고객 앱은 디바이스 토큰/앱 토큰 방식으로 통신한다.
- 파일 업로드는 presign 기반으로 처리한다.
- 응답은 일관된 JSON 포맷을 유지한다.

예시:
```json
{
  "success": true,
  "data": {}
}
```

---

## 4-2. 설계사 앱 API

### 4-2-1. 고객 앱 연결 링크 생성
`POST /api/agent/customer-app-links`

#### request
```json
{
  "customerId": 55
}
```

#### response
```json
{
  "success": true,
  "data": {
    "linkId": 10,
    "linkCode": "ABC123XYZ",
    "connectUrl": "myapp://connect/ABC123XYZ",
    "universalUrl": "https://your-domain.com/customer-app/connect/ABC123XYZ"
  }
}
```

#### 검증
- 로그인 사용자 = 설계사 또는 권한 있는 사용자
- 해당 고객이 본인 접근 범위 내인지 검증

---

### 4-2-2. 고객별 연결 상태 조회
`GET /api/agent/customers/:customerId/customer-app-link`

#### response
- 링크 생성 여부
- 마지막 연결 시간
- 연결된 디바이스 수
- 상태

---

### 4-2-3. 청구 요청 리스트 조회
`GET /api/agent/customer-claim-requests`

#### query
- `status`
- `customerId`
- `page`
- `pageSize`

---

### 4-2-4. 청구 요청 상세 조회
`GET /api/agent/customer-claim-requests/:requestId`

#### response 포함
- 요청 본문
- 첨부 파일 리스트
- 상태 변경 이력

---

### 4-2-5. 청구 요청 상태 변경
`PATCH /api/agent/customer-claim-requests/:requestId/status`

#### request
```json
{
  "status": "processing",
  "memo": "확인 후 처리중"
}
```

#### 규칙
- 상태값 유효성 검증
- 변경 이력 저장
- 필요 시 고객 푸시 발송

---

### 4-2-6. 고객용 소식지 등록
기존 소식지 API가 있으면 재사용, 없으면 신규

`POST /api/agent/customer-news`

#### request
```json
{
  "title": "4월 청구 안내",
  "content": "...",
  "isPinned": false,
  "sendPush": true
}
```

#### 규칙
- 고객 앱 노출 대상 게시물임을 명시
- 등록 후 연결된 고객에게 푸시 가능

---

## 4-3. 고객 앱 API

### 4-3-1. 링크 연결 처리
`POST /api/customer-app/connect`

#### request
```json
{
  "linkCode": "ABC123XYZ",
  "deviceId": "device-uuid",
  "devicePlatform": "android",
  "appVersion": "1.0.0"
}
```

#### response
```json
{
  "success": true,
  "data": {
    "agentId": 10,
    "customerId": 55,
    "agentName": "홍길동 설계사",
    "customerName": "김철수",
    "appToken": "customer-app-jwt-or-session-token"
  }
}
```

#### 처리
- linkCode 검증
- link 상태 active 확인
- device 연결 upsert
- 감사 로그 기록
- 이후 고객 앱용 토큰 발급

---

### 4-3-2. 내 연결 정보 조회
`GET /api/customer-app/me`

#### 응답
- 연결된 설계사명
- 연결된 고객명
- 연결 상태

---

### 4-3-3. 파일 업로드 presign 발급
`POST /api/customer-app/claim-files/presign`

#### request
```json
{
  "fileName": "receipt.jpg",
  "contentType": "image/jpeg",
  "fileSize": 123456
}
```

#### response
```json
{
  "success": true,
  "data": {
    "storageKey": "customer-claims/....jpg",
    "uploadUrl": "https://...",
    "publicUrl": null,
    "putHeaders": {
      "Content-Type": "image/jpeg"
    }
  }
}
```

#### 규칙
- 허용 확장자/용량 검증
- 고객 연결 상태 확인

---

### 4-3-4. 청구 요청 생성
`POST /api/customer-app/claim-requests`

#### request
```json
{
  "title": "병원비 청구 요청",
  "memo": "어제 진료받은 내용입니다.",
  "files": [
    {
      "storageKey": "customer-claims/1.jpg",
      "fileName": "1.jpg",
      "contentType": "image/jpeg",
      "fileSize": 12345
    }
  ]
}
```

#### 처리
- 연결 상태 검증
- request 생성
- file rows 생성
- 상태 로그 requested 기록
- 설계사 측 알림/뱃지 반영 가능

---

### 4-3-5. 내 요청 리스트
`GET /api/customer-app/claim-requests`

---

### 4-3-6. 내 요청 상세
`GET /api/customer-app/claim-requests/:requestId`

---

### 4-3-7. 고객용 소식지 리스트
`GET /api/customer-app/news`

#### query
- `page`
- `pageSize`

#### 처리
- 연결된 `agent_id` 기준으로 필터
- 고객 노출 가능한 게시물만 반환

---

### 4-3-8. 소식지 상세
`GET /api/customer-app/news/:newsId`

---

### 4-3-9. 소식지 읽음 처리
`POST /api/customer-app/news/:newsId/read`

---

### 4-3-10. 푸시 토큰 등록
`POST /api/customer-app/push-token`

#### request
```json
{
  "deviceId": "device-uuid",
  "provider": "expo",
  "pushToken": "ExponentPushToken[...]"
}
```

---

## 4-4. 에러 처리 규칙
- invalid link → 400
- unauthorized → 401
- forbidden → 403
- not found → 404
- invalid status transition → 422
- storage validation fail → 422
- server error → 500

고객 앱에서는 에러 문구를 친절하게 바꿔 보여줘야 한다.

## 4-5. 보안 규칙
- 설계사 API는 기존 인증 체계 유지
- 고객 앱은 appToken 기반으로 제한 접근
- 고객 앱 토큰은 연결 범위를 넘는 리소스 접근 불가
- 파일 presign은 짧은 만료 시간 사용
- 서버는 storageKey 접두사 검증 필수

## 4-6. 로그 권장
- link create
- connect success/fail
- claim request create
- file presign issue
- file save complete
- request status change
- push send success/fail
