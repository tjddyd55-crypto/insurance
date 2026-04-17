# 3. DB 설계서

## 3-1. 설계 원칙
- 기존 `customers` 테이블과 연결 가능해야 한다.
- 고객 앱의 연결 상태, 요청, 첨부, 알림 읽음 등을 별도 테이블로 분리한다.
- 데이터 이력 추적이 가능해야 한다.
- 상태값을 문자열 enum 또는 제한된 코드값으로 관리한다.

## 3-2. 신규 테이블 목록
1. `customer_app_links`
2. `customer_app_devices`
3. `customer_claim_requests`
4. `customer_claim_request_files`
5. `customer_app_push_tokens`
6. `customer_news_reads`
7. `customer_link_audit_logs` (권장)
8. `customer_claim_status_logs` (권장)

---

## 3-3. customer_app_links
고객 앱 연결의 기준 테이블.  
“이 고객이 이 설계사에 연결되어 있다”를 저장한다.

### 컬럼
- `id` PK
- `agent_id` bigint not null
- `customer_id` bigint not null
- `link_code` varchar(64) not null unique
- `status` varchar(20) not null default 'active'
- `created_by_user_id` bigint not null
- `created_at` datetime not null
- `updated_at` datetime not null
- `expires_at` datetime null
- `last_connected_at` datetime null

### 인덱스
- unique(`link_code`)
- index(`agent_id`, `customer_id`)
- index(`status`)

### 설명
- 설계사가 고객별로 생성한 연결 코드
- 초기에 만료 없이 운영 가능하나, 보안상 만료 정책을 추후 둘 수 있게 필드 마련

---

## 3-4. customer_app_devices
실제 기기와 고객/설계사 연결 상태 저장

### 컬럼
- `id` PK
- `link_id` bigint not null
- `agent_id` bigint not null
- `customer_id` bigint not null
- `device_id` varchar(191) not null
- `device_platform` varchar(20) null
- `app_version` varchar(30) null
- `status` varchar(20) not null default 'active'
- `connected_at` datetime not null
- `last_active_at` datetime null
- `disconnected_at` datetime null
- `created_at` datetime not null
- `updated_at` datetime not null

### 인덱스
- unique(`device_id`, `agent_id`, `customer_id`)
- index(`agent_id`, `customer_id`)
- index(`status`)
- index(`last_active_at`)

### 설명
- 한 고객이 여러 기기를 쓸 수 있으면 허용
- 하나의 기기당 하나의 고객만 허용할지 정책 결정 필요
- MVP는 “한 기기 = 한 고객 연결”을 권장

---

## 3-5. customer_claim_requests
고객이 보낸 청구 요청 본문

### 컬럼
- `id` PK
- `agent_id` bigint not null
- `customer_id` bigint not null
- `device_id` varchar(191) not null
- `request_type` varchar(30) not null default 'claim'
- `status` varchar(20) not null default 'requested'
- `title` varchar(150) null
- `memo` text null
- `submitted_at` datetime not null
- `processed_at` datetime null
- `processed_by_user_id` bigint null
- `created_at` datetime not null
- `updated_at` datetime not null

### 인덱스
- index(`agent_id`, `customer_id`)
- index(`status`)
- index(`submitted_at`)

### 상태값
- `requested`
- `processing`
- `done`
- `rejected`
- `canceled`

### 설명
- title은 옵션
- memo는 간단 설명
- 실제 운영상 최소 입력을 권장

---

## 3-6. customer_claim_request_files
요청 첨부 파일

### 컬럼
- `id` PK
- `request_id` bigint not null
- `agent_id` bigint not null
- `customer_id` bigint not null
- `storage_key` varchar(255) not null
- `file_name` varchar(255) not null
- `content_type` varchar(100) null
- `file_size` bigint null
- `sort_order` int not null default 0
- `uploaded_at` datetime not null
- `created_at` datetime not null
- `updated_at` datetime not null

### 인덱스
- index(`request_id`)
- index(`agent_id`, `customer_id`)

### 설명
- URL 자체 저장보다 `storage_key` 저장 권장
- 표시용 URL은 서버에서 서명 또는 조합

---

## 3-7. customer_app_push_tokens
푸시 토큰 저장

### 컬럼
- `id` PK
- `agent_id` bigint not null
- `customer_id` bigint not null
- `device_id` varchar(191) not null
- `push_provider` varchar(30) not null
- `push_token` varchar(255) not null
- `status` varchar(20) not null default 'active'
- `last_registered_at` datetime not null
- `created_at` datetime not null
- `updated_at` datetime not null

### 인덱스
- unique(`push_token`)
- index(`agent_id`, `customer_id`)
- index(`device_id`)
- index(`status`)

---

## 3-8. customer_news_reads
소식지 읽음 처리

### 컬럼
- `id` PK
- `news_id` bigint not null
- `agent_id` bigint not null
- `customer_id` bigint not null
- `read_at` datetime not null

### 인덱스
- unique(`news_id`, `customer_id`)
- index(`agent_id`, `customer_id`)

---

## 3-9. customer_link_audit_logs (권장)
연결/재연결/해제/실패 기록

### 컬럼
- `id` PK
- `agent_id` bigint null
- `customer_id` bigint null
- `device_id` varchar(191) null
- `link_code` varchar(64) null
- `action` varchar(30) not null
- `result` varchar(20) not null
- `reason` varchar(255) null
- `meta_json` json null
- `created_at` datetime not null

### action 예시
- `create_link`
- `connect_device`
- `reconnect_device`
- `disconnect_device`
- `invalid_link_attempt`

---

## 3-10. customer_claim_status_logs (권장)
요청 상태 변경 이력

### 컬럼
- `id` PK
- `request_id` bigint not null
- `from_status` varchar(20) null
- `to_status` varchar(20) not null
- `changed_by_user_id` bigint null
- `changed_at` datetime not null
- `memo` varchar(255) null

---

## 3-11. 기존 테이블 재사용
소식지는 기존 설계사/고객용 게시판 또는 소식지 테이블이 있다면 재사용한다.  
단, 고객 앱 노출용 API를 새로 만드는 것을 권장한다.

필수 조건:
- 설계사(또는 작성자)가 식별 가능해야 함
- 고객용으로 노출 가능한 게시물인지 구분 가능해야 함
- `agent_id` 기준 필터 가능해야 함

## 3-12. 데이터 무결성 규칙
- 요청 생성 시 `agent_id`, `customer_id`, `device_id`가 모두 있어야 한다.
- 파일은 반드시 유효한 `request_id`에 귀속되어야 한다.
- 연결이 inactive면 요청 생성 불가
- 고객은 자신의 연결 범위를 넘어선 데이터 접근 불가
- 설계사는 자기 소속 고객 요청만 조회 가능해야 한다.
