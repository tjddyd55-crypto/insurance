# 📦 고객 파일 첨부 기능 - 풀셋 구현 지시문 (Cursor 전용)

## 🎯 목표
고객별로 PDF/파일을 업로드하고, 목록 조회/다운로드/삭제가 가능한 기능을 추가한다.

---

# 1️⃣ DB 설계

## 테이블: customer_files

```sql
CREATE TABLE customer_files (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 2️⃣ API 설계

## 1. presign

POST /api/customers/:id/files/presign

response:
{
  "uploadUrl": "...",
  "fileUrl": "..."
}

---

## 2. 저장

POST /api/customers/:id/files

body:
{
  "fileName": "...",
  "fileUrl": "...",
  "size": 123
}

---

## 3. 조회

GET /api/customers/:id/files

---

## 4. 삭제

DELETE /api/customers/files/:fileId

---

# 3️⃣ 프론트 구현

## 위치

CustomerListCard 내부 (메모 아래)

---

## UI

[파일 첨부]

+ 파일 업로드 버튼

파일1.pdf [다운로드] [삭제]

---

## 업로드 흐름

1. 파일 선택
2. presign 호출
3. PUT 업로드
4. DB 저장 API 호출
5. 리스트 state 업데이트

---

## 상태

const [files, setFiles] = useState([])

---

# 4️⃣ Optimistic UI

업로드 성공 시 즉시 setFiles

삭제 시:
- 먼저 제거
- 실패 시 rollback

---

# 5️⃣ 금지

- 전체 고객 리스트 refetch 금지
- window.location.reload 금지

---

# 6️⃣ 작업 순서

1. DB 생성
2. API 구현
3. 프론트 UI 추가
4. 업로드 연결
5. 삭제 기능
6. 테스트

---

# 🔥 핵심

👉 기존 구조 절대 건드리지 말고 기능만 추가한다
