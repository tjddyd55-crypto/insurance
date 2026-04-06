# FIX: 고객 메모 추가 후 `undefined.id` 에러 (정석 해결)

## 1. 문제 정의

- 메모 추가 API는 성공했지만, 이후 `customers` 상태를 부분 갱신하면서 응답 `data`가 비정상일 때 불완전 객체가 섞임.
- 목록 렌더에서 `customer.id` 접근 시 크래시.

## 2. 해결 원칙

- **부분 `setState`(map으로 한 명만 덮어쓰기)** 로 메모 반영을 하지 않는다.
- **서버 기준 재동기화**: 메모 저장 성공 후 `listCustomers`(전체 목록 API)를 다시 호출하고 `setCustomers`로 **통째로 교체**한다.

## 3. 구현 요약 (코드베이스)

| 위치 | 내용 |
|------|------|
| `CustomerInlineNotesSection` | `updateCustomer` 성공 뒤 `onPersisted()`만 호출 (응답으로 `setState` 안 함) |
| `CustomersPage` | `onCustomerNotesPersisted={() => void loadCustomers()}` |
| `customersApi.listCustomers` | `data`가 배열인지 검증, 행은 `id`가 유효한 것만 유지 |
| `customersApi.updateCustomer` / `saveCustomer` 등 | 응답 `data`에 유효한 `id` 있는지 검증, 없으면 `ApiError` |

개발 모드에서 `listCustomers`는 검증된 목록을 `console.log`로 남긴다.

## 4. 서버 계약 (현행)

- `PUT /api/customers/:id` 성공 시 `{ success: true, data: Customer }`.
- `data`가 없거나 `id`가 없으면 프론트는 오류로 처리한다.
- 향후 `{ success: true }`만 오는 경우가 생기면, 프론트는 **무조건** `listCustomers`로 재조회하는 정책을 유지한다.

## 5. 완료 기준

- 메모 추가/삭제 후 화면이 깨지지 않는다.
- `customers`에 `id` 없는 항목이 들어가지 않는다 (API 파싱 단계에서 제거 또는 에러).

## 6. 참고

- 장기적으로는 React Query / SWR 등으로 목록 무효화(invalidate) 패턴을 쓰면 동일 원칙을 더 단순화할 수 있다.
